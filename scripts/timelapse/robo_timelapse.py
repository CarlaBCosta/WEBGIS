#!/usr/bin/env python3
"""
Robô de timelapse — atende a fila de pedidos criada pelo painel admin.

Ciclo: sinaliza que está vivo (timelapse_robo), recupera pedidos abandonados,
pega o pedido pendente mais antigo (timelapse_jobs), baixa a camada de fazendas
do Storage, gera um MP4 por fazenda com as funções de timelapse_fazenda.py e
registra cada resultado (timelapse_videos) e o andamento do pedido.

Fase local: roda no computador da equipe, ligado pelo Agendador do Windows ao
fazer logon (ver INICIAR-ROBO-TIMELAPSE.bat e README.md). Depois migra para o
Google Cloud sem mudar a lógica.

Uso:
    python robo_timelapse.py            # fica rodando
    python robo_timelapse.py --uma-vez  # uma passada e sai (testes)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import socket
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import timelapse_fazenda as tf  # noqa: E402

VERSAO = "1.0"
ENV_PADRAO = AQUI.parent.parent / ".env.local"  # webgis_portal/.env.local
SAIDA_PADRAO = Path(r"C:\timelapse_saida")
PROJETO_PADRAO = "gis-esg"
INTERVALO_S = 30
VERIFICAR_A_CADA_S = 20  # durante um pedido: checa cancelamento e sinaliza "online"
# Pedido "processando" sem sinal há mais que isso é considerado abandonado
# (robô desligado no meio) e volta para a fila. Seguro ser curto nesta fase
# local: a trava de porta impede um segundo robô na máquina, e o sinal do
# pedido é renovado a cada fazenda e durante as esperas entre tentativas.
# Ao levar o robô para o Google Cloud com mais de uma instância, revisar.
ORFAO_APOS = timedelta(minutes=3)
TENTATIVAS_POR_FAZENDA = 3
ESPERAS_S = [15, 60]  # entre tentativas — falhas passageiras do Google (ex.: HTTP 503)
# Porta local usada só como trava: impede dois robôs na mesma máquina.
PORTA_TRAVA = 47311

# Plano gratuito do Supabase: 1 GB de arquivos no total. As camadas GeoJSON dos
# clientes também ocupam esse espaço, então os vídeos ficam limitados a 800 MB.
# No Supabase Pro (100 GB), rode com --limite-publicacao-mb maior.
LIMITE_PUBLICACAO_MB = 800

MESES = (5, 9)
DIMENSAO = 768
FPS = 2
MARGEM_M = 300


def agora() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def log(msg: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

def ler_env(caminho: Path) -> dict[str, str]:
    """Lê KEY=VALUE do .env.local. utf-8-sig ignora BOM (já causou falha antes)."""
    if not caminho.exists():
        raise tf.ErroTimelapse(f"Arquivo de configuração não encontrado: {caminho}")
    valores: dict[str, str] = {}
    for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valores[chave.strip()] = valor.strip().strip('"').strip("'")
    return valores


# ---------------------------------------------------------------------------
# Supabase (REST)
# ---------------------------------------------------------------------------

class Supabase:
    def __init__(self, url: str, chave: str):
        self.url = url.rstrip("/")
        self.chave = chave

    def _req(self, metodo: str, caminho: str, corpo=None, prefer: str | None = None):
        cabecalhos = {
            "apikey": self.chave,
            "Authorization": f"Bearer {self.chave}",
            "Content-Type": "application/json",
        }
        if prefer:
            cabecalhos["Prefer"] = prefer
        dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
        req = urllib.request.Request(f"{self.url}/rest/v1/{caminho}", data=dados,
                                     method=metodo, headers=cabecalhos)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                texto = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detalhe = exc.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"Supabase {metodo} {caminho.split('?')[0]}: HTTP {exc.code} {detalhe}")
        return json.loads(texto) if texto else None

    def get(self, caminho: str):
        return self._req("GET", caminho)

    def patch(self, caminho: str, corpo: dict, retornar: bool = False):
        return self._req("PATCH", caminho, corpo, "return=representation" if retornar else None)

    def upsert(self, tabela: str, corpo: dict, conflito: str):
        return self._req("POST", f"{tabela}?on_conflict={conflito}", corpo,
                         "resolution=merge-duplicates")

    def get_todos(self, caminho: str, pagina: int = 1000) -> list:
        """GET paginado (a API devolve no máximo 1000 linhas por vez)."""
        linhas: list = []
        while True:
            sep = "&" if "?" in caminho else "?"
            lote = self.get(f"{caminho}{sep}limit={pagina}&offset={len(linhas)}") or []
            linhas.extend(lote)
            if len(lote) < pagina:
                return linhas

    # Storage ---------------------------------------------------------------

    def _storage(self, metodo: str, caminho: str, dados: bytes | None, cabecalhos: dict):
        req = urllib.request.Request(f"{self.url}/storage/v1/{caminho}", data=dados, method=metodo,
                                     headers={"apikey": self.chave,
                                              "Authorization": f"Bearer {self.chave}", **cabecalhos})
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            detalhe = exc.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"Storage {metodo} {caminho}: HTTP {exc.code} {detalhe}")

    def storage_enviar(self, bucket: str, caminho: str, dados: bytes, content_type: str,
                       max_age_s: int) -> None:
        self._storage("POST", f"object/{bucket}/{urllib.parse.quote(caminho, safe='/')}", dados, {
            "Content-Type": content_type, "x-upsert": "true", "cache-control": f"max-age={max_age_s}",
        })

    def storage_apagar(self, bucket: str, caminhos: list[str]) -> None:
        self._storage("DELETE", f"object/{bucket}", json.dumps({"prefixes": caminhos}).encode("utf-8"),
                      {"Content-Type": "application/json"})


def q(valor: str) -> str:
    return urllib.parse.quote(str(valor), safe="")


# ---------------------------------------------------------------------------
# Fila
# ---------------------------------------------------------------------------

class Publicador:
    """Publica a versão web de cada vídeo no bucket público do Supabase Storage.

    O MP4 gerado (768 px) é convertido para uma versão leve (512 px, CRF 28, 8 fps)
    antes do envio: no teste em 14/09/2026 a fazenda 600081 caiu de 2,9 MB para
    667 KB sem diferença visível — a imagem Landsat de 30 m já é pouco nítida.
    Isso faz as 613 fazendas caberem no 1 GB do plano gratuito. No plano Pro, basta
    publicar em qualidade maior (WEB_LARGURA/WEB_CRF).

    Nunca ultrapassa `limite_bytes` somando o que já está publicado (todas as
    fazendas de todos os clientes): acima disso, registra aviso e não envia.
    """

    BUCKET = "timelapses"
    WEB_LARGURA = 512
    WEB_CRF = 28
    WEB_FPS = 8
    CACHE_S = 86400

    def __init__(self, sb: Supabase, url_publica: str, limite_bytes: int):
        import imageio_ffmpeg
        self.sb = sb
        self.ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        self.prefixo_url = f"{url_publica.rstrip('/')}/storage/v1/object/public/{self.BUCKET}/"
        self.limite_bytes = limite_bytes
        self.usado_bytes = 0

    def atualizar_uso(self) -> None:
        linhas = self.sb.get_todos("timelapse_videos?url=not.is.null&select=tamanho_bytes")
        self.usado_bytes = sum(l.get("tamanho_bytes") or 0 for l in linhas)

    def versao_web(self, origem: Path, destino: Path) -> None:
        comando = [
            self.ffmpeg, "-y", "-loglevel", "error", "-i", str(origem),
            "-vf", f"scale={self.WEB_LARGURA}:-2", "-r", str(self.WEB_FPS),
            "-c:v", "libx264", "-crf", str(self.WEB_CRF), "-preset", "slow",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destino),
        ]
        resultado = subprocess.run(comando, capture_output=True, text=True)
        if resultado.returncode != 0:
            raise RuntimeError(f"ffmpeg falhou: {resultado.stderr.strip()[:300]}")

    def publicar(self, slug: str, codigo: str, sensor: str, mp4: Path,
                 anterior: dict | None) -> tuple[str, int] | None:
        """Envia a versão web e devolve (url, tamanho); None se estourar o limite."""
        with tempfile.TemporaryDirectory() as tmp:
            web = Path(tmp) / "web.mp4"
            self.versao_web(mp4, web)
            dados = web.read_bytes()

        tamanho_anterior = (anterior or {}).get("tamanho_bytes") or 0
        if self.usado_bytes - tamanho_anterior + len(dados) > self.limite_bytes:
            return None

        # Nome: <sensor>-<ano inicial>-<ano final>-<hash>.mp4. Os anos vêm do nome do
        # MP4 local (timelapse_<codigo>_<sensor>_<inicio>-<fim>.mp4) e o portal os lê
        # da URL; o hash deixa o link não adivinhável e troca a URL quando o vídeo é
        # refeito (sem cache antigo).
        anos = re.search(r"_(\d{4})-(\d{4})\.mp4$", mp4.name)
        trecho_anos = f"{anos.group(1)}-{anos.group(2)}-" if anos else ""
        caminho = f"{tf.nome_seguro(slug)}/{tf.nome_seguro(codigo)}/{sensor}-{trecho_anos}" \
                  f"{hashlib.sha256(dados).hexdigest()[:12]}.mp4"
        self.sb.storage_enviar(self.BUCKET, caminho, dados, "video/mp4", self.CACHE_S)

        url_anterior = (anterior or {}).get("url") or ""
        if url_anterior.startswith(self.prefixo_url):
            caminho_anterior = urllib.parse.unquote(url_anterior[len(self.prefixo_url):])
            if caminho_anterior != caminho:
                self.sb.storage_apagar(self.BUCKET, [caminho_anterior])

        self.usado_bytes += len(dados) - tamanho_anterior
        return self.prefixo_url + urllib.parse.quote(caminho, safe="/"), len(dados)


class Robo:
    def __init__(self, sb: Supabase, url_publica: str, saida: Path, publicador: Publicador):
        self.sb = sb
        self.url_publica = url_publica.rstrip("/")
        self.saida = saida
        self.publicador = publicador

    def sinalizar(self) -> None:
        self.sb.patch("timelapse_robo?id=eq.1", {
            "ultimo_sinal": iso(agora()), "versao": VERSAO, "maquina": socket.gethostname(),
        })

    def recuperar_orfaos(self) -> None:
        jobs = self.sb.get("timelapse_jobs?status=eq.processando&select=id,heartbeat_at,started_at") or []
        for job in jobs:
            ultimo = job.get("heartbeat_at") or job.get("started_at")
            parado = ultimo is None or agora() - datetime.fromisoformat(ultimo) > ORFAO_APOS
            if parado:
                self.sb.patch(f"timelapse_jobs?id=eq.{job['id']}&status=eq.processando",
                              {"status": "pendente", "mensagem": "Retomado após interrupção do robô"})
                log(f"Pedido {job['id']} estava abandonado — voltou para a fila.")

    def pegar_proximo(self) -> dict | None:
        pendentes = self.sb.get("timelapse_jobs?status=eq.pendente&order=created_at.asc&limit=1") or []
        if not pendentes:
            return None
        job = pendentes[0]
        # O filtro status=eq.pendente no PATCH garante que só um robô assume o pedido.
        assumido = self.sb.patch(
            f"timelapse_jobs?id=eq.{job['id']}&status=eq.pendente",
            {"status": "processando", "started_at": iso(agora()), "heartbeat_at": iso(agora()),
             "concluidas": 0, "falhas": 0, "finished_at": None},
            retornar=True,
        )
        return assumido[0] if assumido else None

    def status_atual(self, job_id: str) -> str | None:
        linhas = self.sb.get(f"timelapse_jobs?id=eq.{job_id}&select=status") or []
        return linhas[0]["status"] if linhas else None

    def finalizar(self, job_id: str, status: str, mensagem: str) -> None:
        self.sb.patch(f"timelapse_jobs?id=eq.{job_id}", {
            "status": status, "mensagem": mensagem,
            "finished_at": iso(agora()), "heartbeat_at": iso(agora()),
        })
        log(f"Pedido {job_id}: {status} — {mensagem}")

    # -----------------------------------------------------------------------

    def processar(self, job: dict) -> None:
        job_id = job["id"]
        clientes = self.sb.get(f"clients?id=eq.{job['client_id']}&select=slug,name") or []
        if not clientes:
            return self.finalizar(job_id, "erro", "Cliente não encontrado.")
        slug = clientes[0]["slug"]

        camadas = self.sb.get(
            f"layers?client_id=eq.{job['client_id']}&layer_key=eq.{q(job['layer_key'])}&select=storage_path"
        ) or []
        caminho_storage = camadas[0].get("storage_path") if camadas else None
        if not caminho_storage:
            return self.finalizar(job_id, "erro",
                                  f"A camada '{job['layer_key']}' não existe ou não tem arquivo enviado.")

        log(f"Pedido {job_id}: cliente {slug}, camada {job['layer_key']}, campo {job['campo']}, "
            f"sensor {job['sensor']}")

        with tempfile.TemporaryDirectory() as tmp:
            arquivo = Path(tmp) / "camada.geojson"
            url = (f"{self.url_publica}/storage/v1/object/public/client-data/"
                   f"{urllib.parse.quote(caminho_storage, safe='/')}")
            urllib.request.urlretrieve(url, arquivo)
            try:
                grupos = tf.carregar_geojson(arquivo, job["campo"])
            except tf.ErroTimelapse as exc:
                return self.finalizar(job_id, "erro", str(exc))

        codigos = sorted(grupos, key=lambda c: (len(c), c))
        self.sb.patch(f"timelapse_jobs?id=eq.{job_id}", {"total": len(codigos)})

        fim = tf.ano_final_padrao(MESES)
        inicio = tf.SENTINEL2_PRIMEIRO_ANO if job["sensor"] == "sentinel2" else 2007
        cfg = argparse.Namespace(
            sensor=job["sensor"], inicio=inicio, fim=fim, meses=MESES,
            saida=self.saida / tf.nome_seguro(slug), dimensao=DIMENSAO, fps=FPS,
            margem_m=MARGEM_M, sobrescrever=False, somente_mp4=True,
        )

        # Vídeos já publicados deste cliente/sensor (uma consulta só): fazenda pulada
        # que já tem URL não é reenviada.
        existentes = {
            v["codigo"]: v for v in self.sb.get_todos(
                f"timelapse_videos?client_id=eq.{job['client_id']}&sensor=eq.{job['sensor']}"
                f"&select=codigo,url,tamanho_bytes")
        }
        self.publicador.atualizar_uso()
        log(f"Armazenamento de vídeos em uso: {self.publicador.usado_bytes / 1048576:.0f} MB "
            f"de {self.publicador.limite_bytes / 1048576:.0f} MB permitidos.")

        concluidas = falhas = 0
        ultima_verificacao = 0.0
        for i, codigo in enumerate(codigos, 1):
            # Cancelamento e sinal de vida a cada VERIFICAR_A_CADA_S, não a cada
            # fazenda: pular as já prontas fica muito mais rápido.
            if time.monotonic() - ultima_verificacao >= VERIFICAR_A_CADA_S:
                ultima_verificacao = time.monotonic()
                if self.status_atual(job_id) == "cancelado":
                    log(f"Pedido {job_id} cancelado pelo painel na fazenda {i} de {len(codigos)}.")
                    return
                self.sinalizar()
            print(f"[{i}/{len(codigos)}] Fazenda {codigo}", flush=True)
            relatorio = self.gerar_com_tentativas(job_id, codigo, grupos[codigo], cfg)
            sucesso = relatorio["status"] == "ok" or relatorio["status"].startswith("pulada")
            if sucesso:
                concluidas += 1
            else:
                falhas += 1
            self.registrar_video(job, slug, codigo, relatorio, sucesso, existentes.get(codigo))
            self.sb.patch(f"timelapse_jobs?id=eq.{job_id}", {
                "concluidas": concluidas, "falhas": falhas, "heartbeat_at": iso(agora()),
            })

        self.finalizar(job_id, "concluido",
                       f"{concluidas} vídeo(s) pronto(s), {falhas} com falha, de {len(codigos)} fazenda(s).")

    def gerar_com_tentativas(self, job_id: str, codigo: str, feicoes: list[dict], cfg) -> dict:
        ultimo_erro = ""
        for tentativa in range(1, TENTATIVAS_POR_FAZENDA + 1):
            try:
                return tf.gerar_fazenda(codigo, feicoes, cfg)
            except Exception as exc:  # falhas passageiras do Google/rede
                ultimo_erro = str(exc)
                if tentativa < TENTATIVAS_POR_FAZENDA:
                    espera = ESPERAS_S[tentativa - 1]
                    log(f"  fazenda {codigo}: tentativa {tentativa} falhou ({ultimo_erro}); "
                        f"nova tentativa em {espera} s")
                    try:  # mantém o pedido "vivo" durante a espera
                        self.sb.patch(f"timelapse_jobs?id=eq.{job_id}", {"heartbeat_at": iso(agora())})
                        self.sinalizar()
                    except Exception:
                        pass
                    time.sleep(espera)
        log(f"  fazenda {codigo}: falhou após {TENTATIVAS_POR_FAZENDA} tentativas ({ultimo_erro})")
        return {"codigo": codigo, "status": f"erro: {ultimo_erro}", "anos": "",
                "cenas_por_ano": "", "avisos": [], "gif": "", "mp4": ""}

    def registrar_video(self, job: dict, slug: str, codigo: str, relatorio: dict, sucesso: bool,
                        anterior: dict | None) -> None:
        corpo = {
            "client_id": job["client_id"], "job_id": job["id"], "codigo": codigo,
            "sensor": job["sensor"], "layer_key": job["layer_key"],
            "status": "ok" if sucesso else "erro",
            "arquivo_local": relatorio.get("mp4") if sucesso else None,
            "updated_at": iso(agora()),
        }
        # Fazenda pulada (vídeo já existia) não tem anos/cenas nesta rodada:
        # só envia esses campos quando existem, para não apagar os anteriores.
        if relatorio.get("anos"):
            corpo["anos"] = relatorio["anos"]
        if relatorio.get("cenas_por_ano"):
            corpo["cenas_por_ano"] = relatorio["cenas_por_ano"]
        avisos = list(relatorio.get("avisos") or [])
        if not sucesso:
            avisos.append(relatorio["status"])

        # Publica se o vídeo foi gerado agora ou se ainda não tem URL.
        gerado_agora = relatorio["status"] == "ok"
        ja_publicado = bool((anterior or {}).get("url"))
        mp4 = Path(relatorio["mp4"]) if relatorio.get("mp4") else None
        if sucesso and mp4 and mp4.exists() and (gerado_agora or not ja_publicado):
            try:
                publicado = self.publicador.publicar(slug, codigo, job["sensor"], mp4, anterior)
                if publicado:
                    corpo["url"], corpo["tamanho_bytes"] = publicado
                else:
                    avisos.append("não publicado: limite de armazenamento atingido")
                    log(f"  fazenda {codigo}: não publicada — limite de armazenamento atingido.")
            except Exception as exc:  # falha de envio não invalida o vídeo gerado
                avisos.append(f"não publicado: {exc}")
                log(f"  fazenda {codigo}: falha ao publicar ({exc}); tenta de novo no próximo pedido.")

        if avisos:
            corpo["avisos"] = " | ".join(avisos)
        self.sb.upsert("timelapse_videos", corpo, "client_id,codigo,sensor")


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------

def travar_instancia_unica() -> socket.socket | None:
    trava = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        trava.bind(("127.0.0.1", PORTA_TRAVA))
        trava.listen(1)
        return trava
    except OSError:
        trava.close()
        return None


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    p = argparse.ArgumentParser(description="Robô que atende a fila de timelapses do painel admin.")
    p.add_argument("--env", type=Path, default=ENV_PADRAO, help="arquivo .env.local do portal")
    p.add_argument("--saida", type=Path, default=SAIDA_PADRAO, help="pasta raiz dos vídeos")
    p.add_argument("--projeto", default=PROJETO_PADRAO, help="projeto Google Cloud do Earth Engine")
    p.add_argument("--intervalo", type=int, default=INTERVALO_S, help="segundos entre consultas à fila")
    p.add_argument("--uma-vez", action="store_true", dest="uma_vez", help="uma passada e sai")
    p.add_argument("--limite-publicacao-mb", type=int, default=LIMITE_PUBLICACAO_MB,
                   dest="limite_publicacao_mb",
                   help="teto de espaço dos vídeos publicados, somando todos os clientes")
    args = p.parse_args()

    trava = travar_instancia_unica()
    if trava is None:
        log("Já existe um robô rodando nesta máquina — encerrando esta cópia.")
        return 0

    try:
        env = ler_env(args.env)
        sb = Supabase(env["SUPABASE_URL"], env["SUPABASE_SECRET_KEY"])
        url_publica = env.get("NEXT_PUBLIC_SUPABASE_URL") or env["SUPABASE_URL"]
    except (tf.ErroTimelapse, KeyError) as exc:
        log(f"ERRO de configuração: {exc}")
        return 1

    if tf.ee is None:
        log("ERRO: earthengine-api não instalado no Python do robô.")
        return 1

    publicador = Publicador(sb, url_publica, args.limite_publicacao_mb * 1048576)
    robo = Robo(sb, url_publica, args.saida, publicador)
    args.saida.mkdir(parents=True, exist_ok=True)
    log(f"Robô de timelapse {VERSAO} iniciado em {socket.gethostname()} "
        f"(projeto {args.projeto}, saída {args.saida}).")

    earth_engine_ok = False
    while True:
        try:
            if not earth_engine_ok:
                tf.inicializar_earth_engine(args.projeto)
                earth_engine_ok = True
                log("Earth Engine conectado.")
            robo.sinalizar()
            robo.recuperar_orfaos()
            job = robo.pegar_proximo()
            if job:
                try:
                    robo.processar(job)
                except Exception as exc:
                    log(f"Pedido {job['id']} falhou: {exc}\n{traceback.format_exc()}")
                    try:
                        robo.finalizar(job["id"], "erro", f"Falha inesperada: {exc}")
                    except Exception:
                        pass  # sem conexão: a retomada de órfãos devolve o pedido à fila
                if not args.uma_vez:
                    continue  # verifica logo se há outro pedido
        except tf.ErroTimelapse as exc:
            # Earth Engine indisponível (sem internet no boot, credencial expirada...).
            log(f"Earth Engine indisponível, nova tentativa em {args.intervalo} s: {exc}")
        except Exception as exc:
            log(f"Falha no ciclo (nova tentativa em {args.intervalo} s): {exc}")

        if args.uma_vez:
            return 0
        time.sleep(args.intervalo)


if __name__ == "__main__":
    sys.exit(main())
