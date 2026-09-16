#!/usr/bin/env python3
"""
Timelapse anual de satélite por fazenda — Google Earth Engine + geemap.

Gera, para o polígono de uma fazenda (ou de todas, em lote), um quadro por ano
com a composição de imagens da estação escolhida, e salva GIF e MP4 com o ano
escrito em cada quadro.

Exemplos:
    python timelapse_fazenda.py --geojson ADA.geojson --codigo 2502 --projeto meu-projeto-ee
    python timelapse_fazenda.py --geojson ADA.geojson --codigo 2502 --detalhe
    python timelapse_fazenda.py --geojson ADA.geojson --todas --limite 3

Veja README.md para instalação, autenticação e limitações.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

try:
    import ee
except ImportError:  # tratado com mensagem clara em main()
    ee = None


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Landsat Collection 2, Level-2 (reflectância de superfície).
# (id da coleção, bandas vermelho/verde/azul originais, último ano em que é usada)
LANDSAT_COLECOES = [
    ("LANDSAT/LT05/C02/T1_L2", ["SR_B3", "SR_B2", "SR_B1"], None),  # TM, até nov/2011
    # ETM+ só entra até 2013: depois o Landsat 8 cobre sozinho, e as listras da
    # falha de SLC (desde 2003) só atrapalhariam. Em 2012 ele é o único disponível.
    ("LANDSAT/LE07/C02/T1_L2", ["SR_B3", "SR_B2", "SR_B1"], 2013),
    ("LANDSAT/LC08/C02/T1_L2", ["SR_B4", "SR_B3", "SR_B2"], None),  # OLI, desde abr/2013
    ("LANDSAT/LC09/C02/T1_L2", ["SR_B4", "SR_B3", "SR_B2"], None),  # OLI-2, desde 2021
]

# Fator de escala oficial da Collection 2 Level-2 para as bandas SR_B*.
LANDSAT_ESCALA = 0.0000275
LANDSAT_DESLOCAMENTO = -0.2

# Bits do QA_PIXEL que tornam o pixel inválido:
# 0 preenchimento, 1 nuvem dilatada, 2 cirro (só OLI; nos demais é sempre 0),
# 3 nuvem, 4 sombra de nuvem, 5 neve.
LANDSAT_BITS_INVALIDOS = 0b111111

SENTINEL2_COLECAO = "COPERNICUS/S2_SR_HARMONIZED"
SENTINEL2_CLOUDSCORE = "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"
SENTINEL2_LIMIAR_CS = 0.60  # cs_cdf >= 0,60 = pixel considerado limpo
# A coleção de superfície (L2A) tem cobertura consistente no Brasil só a partir
# de 2017, embora o satélite opere desde meados de 2015.
SENTINEL2_PRIMEIRO_ANO = 2017

# Visualização em cor verdadeira (reflectância 0–1).
VIS_RGB = {"bands": ["red", "green", "blue"], "min": 0.0, "max": 0.3, "gamma": 1.3}

COR_CONTORNO = "FFFF00"
FPS_VIDEO_MP4 = 24  # o MP4 é gravado a 24 fps repetindo quadros: tocadores lidam mal com 1–2 fps

INSTRUCOES_AUTENTICACAO = """
============================================================================
 ANTES DE RODAR — autenticação do Google Earth Engine (fazer uma única vez)
============================================================================
 1. Tenha um projeto no Google Cloud com a "Earth Engine API" habilitada e
    registrado para uso do Earth Engine:
        https://code.earthengine.google.com/register
 2. Autentique esta máquina (abre o navegador para login na conta Google):
        earthengine authenticate
 3. Informe o ID do projeto ao rodar o script:
        --projeto SEU-PROJETO     (ou a variável de ambiente EE_PROJECT)

 Uso comercial do Earth Engine exige licença paga — confirme o enquadramento
 da empresa antes de rodar em produção.
============================================================================
"""


# ---------------------------------------------------------------------------
# Utilidades de console
# ---------------------------------------------------------------------------

class ErroTimelapse(Exception):
    """Erro com mensagem já pronta para o usuário."""


def falhar(mensagem: str) -> None:
    # Lança em vez de encerrar o processo: o robô (robo_timelapse.py) reutiliza
    # estas funções e não pode ser derrubado por uma fazenda com problema.
    # No modo linha de comando, main() captura e sai com código 1.
    raise ErroTimelapse(mensagem)


def aviso(mensagem: str) -> None:
    print(f"  AVISO: {mensagem}")


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

def inicializar_earth_engine(projeto: str | None) -> None:
    """Inicializa o Earth Engine; nunca dispara login — falha com orientação."""
    try:
        if projeto:
            ee.Initialize(project=projeto)
        else:
            ee.Initialize()
    except Exception as exc:  # os tipos de erro variam entre versões da biblioteca
        texto = str(exc)
        baixo = texto.lower()
        if any(p in baixo for p in ("credential", "authenticate", "authorize", "token")):
            causa = ("Esta máquina não está autenticada no Earth Engine. "
                     "Rode `earthengine authenticate` e tente de novo.")
        elif "not registered" in baixo or "not been registered" in baixo:
            causa = ("O projeto informado não está registrado para uso do Earth Engine. "
                     "Registre em https://code.earthengine.google.com/register.")
        elif "has not been used" in baixo or "service_disabled" in baixo or "disabled" in baixo:
            causa = "A Earth Engine API não está habilitada neste projeto do Google Cloud."
        elif "project" in baixo:
            causa = ("Nenhum projeto válido do Google Cloud foi informado. "
                     "Use --projeto SEU-PROJETO ou defina a variável EE_PROJECT.")
        elif "permission" in baixo or "403" in baixo:
            causa = "Sua conta não tem permissão de uso do Earth Engine neste projeto."
        else:
            causa = "Não foi possível inicializar o Earth Engine."
        falhar(f"{causa}\n       Detalhe técnico: {texto}")


# ---------------------------------------------------------------------------
# Entrada (GeoJSON)
# ---------------------------------------------------------------------------

def _primeira_coordenada(coords):
    while isinstance(coords, list) and coords and isinstance(coords[0], list):
        coords = coords[0]
    return coords


def carregar_geojson(caminho: Path, campo: str) -> dict[str, list[dict]]:
    """Lê o GeoJSON, valida a projeção e agrupa as feições pelo código da fazenda."""
    if not caminho.exists():
        falhar(f"Arquivo não encontrado: {caminho}")
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        falhar(f"O arquivo não é um JSON válido: {exc}")

    feicoes = dados.get("features") or []
    if not feicoes:
        falhar("O GeoJSON não tem feições (esperado um FeatureCollection).")

    crs = json.dumps(dados.get("crs", "")).upper()
    xy = _primeira_coordenada((feicoes[0].get("geometry") or {}).get("coordinates"))
    parece_projetado = "31982" in crs or "UTM" in crs or (
        isinstance(xy, list) and len(xy) >= 2 and (abs(xy[0]) > 180 or abs(xy[1]) > 90)
    )
    if parece_projetado:
        falhar("As coordenadas parecem estar em metros (ex.: SIRGAS 2000 / UTM 22S), "
               "mas o script espera EPSG:4326 (graus). Use a versão reprojetada do arquivo "
               "(ex.: a pasta processed/) ou reprojete no QGIS antes.")

    campos = feicoes[0].get("properties") or {}
    if campo not in campos:
        falhar(f"O campo '{campo}' não existe no arquivo. Campos disponíveis: "
               f"{', '.join(campos.keys())}. Use --campo para escolher outro.")

    grupos: dict[str, list[dict]] = {}
    for f in feicoes:
        valor = (f.get("properties") or {}).get(campo)
        if valor is None or not f.get("geometry"):
            continue
        grupos.setdefault(str(valor), []).append(f)
    return grupos


# ---------------------------------------------------------------------------
# Coleções e composição anual
# ---------------------------------------------------------------------------

def _janela(ano: int, meses: tuple[int, int]):
    inicio = ee.Date.fromYMD(ano, meses[0], 1)
    fim = ee.Date.fromYMD(ano, meses[1], 1).advance(1, "month")
    return inicio, fim


def _preparar_landsat(img, bandas: list[str]):
    qa = img.select("QA_PIXEL")
    limpo = qa.bitwiseAnd(LANDSAT_BITS_INVALIDOS).eq(0)
    rgb = (img.select(bandas, ["red", "green", "blue"])
              .multiply(LANDSAT_ESCALA).add(LANDSAT_DESLOCAMENTO))
    return ee.Image(rgb.updateMask(limpo).copyProperties(img, ["system:time_start"]))


def colecao_landsat(regiao, ano: int, meses: tuple[int, int]):
    inicio, fim = _janela(ano, meses)
    colecao = None
    for colecao_id, bandas, ano_max in LANDSAT_COLECOES:
        if ano_max is not None and ano > ano_max:
            continue
        c = (ee.ImageCollection(colecao_id)
               .filterBounds(regiao)
               .filterDate(inicio, fim)
               .map(lambda img, b=bandas: _preparar_landsat(img, b)))
        colecao = c if colecao is None else colecao.merge(c)
    return colecao


def colecao_sentinel2(regiao, ano: int, meses: tuple[int, int]):
    inicio, fim = _janela(ano, meses)
    cloud_score = ee.ImageCollection(SENTINEL2_CLOUDSCORE)

    def preparar(img):
        rgb = img.select(["B4", "B3", "B2"], ["red", "green", "blue"]).divide(10000)
        limpo = img.select("cs_cdf").gte(SENTINEL2_LIMIAR_CS)
        return ee.Image(rgb.updateMask(limpo).copyProperties(img, ["system:time_start"]))

    return (ee.ImageCollection(SENTINEL2_COLECAO)
              .filterBounds(regiao)
              .filterDate(inicio, fim)
              .linkCollection(cloud_score, ["cs_cdf"])
              .map(preparar))


def composicao_anual(colecao):
    # ESCOLHA: MEDIANA dos pixels válidos da janela de meses.
    # - A mediana é robusta a nuvens e sombras residuais que escapam da máscara:
    #   um pixel contaminado em poucas datas não "vence" a estatística.
    # - O "melhor pixel" (qualityMosaic por NDVI, o greenest pixel) puxaria cada
    #   pixel para a data de pico de vegetação — escondendo justamente a colheita
    #   da cana — e junta datas diferentes lado a lado, criando emendas visíveis.
    # - Custo aceito: a mediana suaviza eventos pontuais (ex.: uma queimada rápida).
    return colecao.median()


# ---------------------------------------------------------------------------
# Saídas: texto nos quadros e MP4
# ---------------------------------------------------------------------------

def baixar(url: str, destino: Path) -> None:
    with urllib.request.urlopen(url, timeout=600) as resposta:
        destino.write_bytes(resposta.read())


def escrever_ano_nos_quadros(gif_bruto: Path, gif_final: Path, rotulos: list[str], fps: int) -> None:
    duracao_ms = int(1000 / fps)
    try:
        import geemap
        geemap.add_text_to_gif(
            str(gif_bruto),
            str(gif_final),
            xy=("3%", "88%"),
            text_sequence=rotulos,
            font_type="arial.ttf",
            font_size=36,
            font_color="#FFFFFF",
            add_progress_bar=True,
            progress_bar_color="#9ACD32",
            progress_bar_height=6,
            duration=duracao_ms,
            loop=0,
        )
    except (ImportError, AttributeError, TypeError, OSError, ValueError) as exc:
        # Se a assinatura do geemap mudou nesta versão (ou a fonte não foi
        # encontrada), escreve o ano com Pillow.
        aviso(f"geemap.add_text_to_gif indisponível ou com assinatura diferente ({exc}); "
              "usando Pillow para escrever o ano.")
        _escrever_ano_pillow(gif_bruto, gif_final, rotulos, duracao_ms)


def _escrever_ano_pillow(gif_bruto: Path, gif_final: Path, rotulos: list[str], duracao_ms: int) -> None:
    from PIL import Image, ImageDraw, ImageFont, ImageSequence

    try:
        fonte = ImageFont.truetype("arial.ttf", 36)
    except OSError:
        fonte = ImageFont.load_default()

    quadros = []
    with Image.open(gif_bruto) as im:
        for i, quadro in enumerate(ImageSequence.Iterator(im)):
            q = quadro.convert("RGB")
            ImageDraw.Draw(q).text(
                (int(q.width * 0.03), int(q.height * 0.88)),
                rotulos[i] if i < len(rotulos) else "",
                font=fonte, fill="white", stroke_width=3, stroke_fill="black",
            )
            quadros.append(q)
    quadros[0].save(gif_final, save_all=True, append_images=quadros[1:],
                    duration=duracao_ms, loop=0)


def gif_para_mp4(gif: Path, mp4: Path, fps: int) -> None:
    import imageio.v2 as imageio
    import numpy as np
    from PIL import Image, ImageSequence

    repeticoes = max(1, round(FPS_VIDEO_MP4 / fps))
    with Image.open(gif) as im:
        largura, altura = im.size
        # H.264 (yuv420p) exige largura e altura pares.
        corte = (0, 0, largura - largura % 2, altura - altura % 2)
        with imageio.get_writer(str(mp4), fps=FPS_VIDEO_MP4, codec="libx264",
                                pixelformat="yuv420p", macro_block_size=1) as video:
            for quadro in ImageSequence.Iterator(im):
                matriz = np.asarray(quadro.convert("RGB").crop(corte))
                for _ in range(repeticoes):
                    video.append_data(matriz)


# ---------------------------------------------------------------------------
# Processamento de uma fazenda
# ---------------------------------------------------------------------------

def _tem_coordenadas(coords) -> bool:
    """True se há ao menos um par numérico dentro da estrutura de coordenadas."""
    if isinstance(coords, (list, tuple)):
        if len(coords) >= 2 and all(isinstance(c, (int, float)) for c in coords[:2]):
            return True
        return any(_tem_coordenadas(c) for c in coords)
    return False


def nome_seguro(texto: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", texto).strip("_") or "sem_codigo"


def gerar_fazenda(codigo: str, feicoes: list[dict], cfg: argparse.Namespace) -> dict:
    relatorio = {"codigo": codigo, "status": "", "anos": "", "cenas_por_ano": "",
                 "avisos": [], "gif": "", "mp4": ""}

    pasta = cfg.saida / nome_seguro(codigo)
    base = f"timelapse_{nome_seguro(codigo)}_{cfg.sensor}_{cfg.inicio}-{cfg.fim}"
    gif_final, mp4 = pasta / f"{base}.gif", pasta / f"{base}.mp4"
    relatorio["gif"] = "" if cfg.somente_mp4 else str(gif_final)
    relatorio["mp4"] = str(mp4)

    pronta = mp4.exists() and (cfg.somente_mp4 or gif_final.exists())
    if pronta and not cfg.sobrescrever:
        relatorio["status"] = "pulada (já existe)"
        print("  já existe — pulando (use --sobrescrever para refazer)")
        return relatorio

    # Feições com geometria vazia (o QGIS exporta "coordinates": []) não têm área
    # para recortar; sem nenhuma válida, a fazenda não gera vídeo — e a mensagem
    # diz o motivo real, em vez de "nenhum ano com imagens".
    feicoes = [f for f in feicoes if _tem_coordenadas((f.get("geometry") or {}).get("coordinates"))]
    if not feicoes:
        relatorio["status"] = ("erro: fazenda sem polígono (geometria vazia no arquivo) — "
                               "corrija a geometria no QGIS e reenvie a camada")
        aviso("fazenda sem polígono (geometria vazia no arquivo) — nada a gerar.")
        return relatorio

    fazenda = ee.FeatureCollection([ee.Feature(ee.Geometry(f["geometry"])) for f in feicoes])
    geometria = fazenda.geometry()
    regiao = geometria.bounds().buffer(cfg.margem_m).bounds()

    montar = colecao_landsat if cfg.sensor == "landsat" else colecao_sentinel2
    anos = list(range(cfg.inicio, cfg.fim + 1))

    # Uma única ida ao servidor para contar as cenas de todos os anos.
    cenas = ee.List([montar(regiao, a, cfg.meses).size() for a in anos]).getInfo()

    # Remove anos finais sem imagem (ex.: ano ainda não processado pelo provedor).
    while anos and cenas[-1] == 0:
        anos.pop()
        cenas.pop()

    contorno = ee.Image().byte().paint(fazenda, 1, 2).visualize(palette=[COR_CONTORNO])

    quadros, rotulos, detalhe_cenas = [], [], []
    for ano, n in zip(anos, cenas):
        detalhe_cenas.append(f"{ano}:{n}")
        if n == 0:
            relatorio["avisos"].append(f"{ano} sem cenas válidas — quadro omitido")
            aviso(f"{ano}: nenhuma cena na janela de meses — quadro omitido.")
            continue
        rotulo = str(ano)
        if cfg.sensor == "landsat" and ano == 2012:
            rotulo = "2012*"
            relatorio["avisos"].append("2012 só com Landsat 7 SLC-off (listras)")
            aviso("2012: só havia o Landsat 7 com falha de SLC — o quadro terá listras sem dados.")
        elif n < 3:
            relatorio["avisos"].append(f"{ano} com apenas {n} cena(s)")
            aviso(f"{ano}: apenas {n} cena(s) — pode haver falhas ou resíduo de nuvem.")
        quadro = (composicao_anual(montar(regiao, ano, cfg.meses))
                  .visualize(**VIS_RGB)
                  .blend(contorno))
        quadros.append(quadro)
        rotulos.append(rotulo)

    relatorio["cenas_por_ano"] = " ".join(detalhe_cenas)
    if not quadros:
        relatorio["status"] = "erro: nenhum ano com imagens"
        aviso("nenhum ano com imagens para esta fazenda.")
        return relatorio
    relatorio["anos"] = f"{rotulos[0]}-{rotulos[-1]} ({len(rotulos)} quadros)"

    pasta.mkdir(parents=True, exist_ok=True)
    gif_bruto = pasta / f"{base}_sem_texto.gif"

    print(f"  gerando {len(quadros)} quadros no Earth Engine...")
    url = ee.ImageCollection.fromImages(quadros).getVideoThumbURL({
        "dimensions": cfg.dimensao,
        "region": regiao,
        "framesPerSecond": cfg.fps,
        "crs": "EPSG:3857",
    })
    baixar(url, gif_bruto)

    print("  escrevendo o ano em cada quadro...")
    escrever_ano_nos_quadros(gif_bruto, gif_final, rotulos, cfg.fps)
    gif_bruto.unlink(missing_ok=True)

    print("  convertendo para MP4...")
    gif_para_mp4(gif_final, mp4, cfg.fps)

    # O GIF é etapa intermediária obrigatória (o Earth Engine entrega GIF e o
    # ano é escrito nele); com --somente-mp4 ele é apagado ao final.
    if cfg.somente_mp4:
        gif_final.unlink(missing_ok=True)

    relatorio["status"] = "ok"
    print(f"  pronto: {mp4.name}" if cfg.somente_mp4 else f"  pronto: {gif_final.name} e {mp4.name}")
    return relatorio


# ---------------------------------------------------------------------------
# Linha de comando
# ---------------------------------------------------------------------------

def ler_meses(texto: str) -> tuple[int, int]:
    m = re.fullmatch(r"\s*(\d{1,2})\s*-\s*(\d{1,2})\s*", texto)
    if not m:
        raise argparse.ArgumentTypeError("use o formato INICIO-FIM, ex.: 5-9")
    a, b = int(m.group(1)), int(m.group(2))
    if not (1 <= a <= b <= 12):
        raise argparse.ArgumentTypeError("meses entre 1 e 12, com início <= fim (ex.: 5-9)")
    return a, b


def ano_final_padrao(meses: tuple[int, int]) -> int:
    """Último ano cuja janela de meses já terminou."""
    hoje = date.today()
    return hoje.year if hoje.month > meses[1] else hoje.year - 1


def criar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Timelapse anual de satélite por fazenda (Earth Engine + geemap).")
    p.add_argument("--geojson", required=True, type=Path,
                   help="GeoJSON com os polígonos das fazendas, em EPSG:4326")
    p.add_argument("--campo", default="FAZENDA",
                   help="campo com o código da fazenda (padrão: FAZENDA)")
    alvo = p.add_mutually_exclusive_group(required=True)
    alvo.add_argument("--codigo", help="código de uma fazenda")
    alvo.add_argument("--todas", action="store_true", help="processa todas as fazendas do arquivo")
    p.add_argument("--limite", type=int, help="no modo --todas, processa só as N primeiras")
    p.add_argument("--sensor", choices=["landsat", "sentinel2"], default="landsat",
                   help="landsat (série longa, 30 m) ou sentinel2 (detalhe, 10 m, desde 2017)")
    p.add_argument("--detalhe", action="store_true", help="atalho para --sensor sentinel2")
    p.add_argument("--inicio", type=int, default=2007, help="primeiro ano (padrão: 2007)")
    p.add_argument("--fim", type=int, help="último ano (padrão: o mais recente com janela completa)")
    p.add_argument("--meses", type=ler_meses, default=(5, 9),
                   help="janela de meses da composição anual (padrão: 5-9, estação seca)")
    p.add_argument("--projeto", default=os.environ.get("EE_PROJECT"),
                   help="ID do projeto Google Cloud do Earth Engine (ou variável EE_PROJECT)")
    p.add_argument("--saida", type=Path, default=Path("saida"), help="pasta de saída (padrão: saida)")
    p.add_argument("--dimensao", type=int, default=768, help="lado maior do vídeo em pixels (padrão: 768)")
    p.add_argument("--fps", type=int, default=2, help="anos por segundo (padrão: 2)")
    p.add_argument("--margem-m", type=float, default=300, dest="margem_m",
                   help="margem ao redor da fazenda, em metros (padrão: 300)")
    p.add_argument("--sobrescrever", action="store_true", help="refaz saídas já existentes")
    p.add_argument("--somente-mp4", action="store_true", dest="somente_mp4",
                   help="grava só o MP4 (apaga o GIF intermediário; cerca de metade do espaço)")
    return p


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    try:
        return _executar_linha_de_comando()
    except ErroTimelapse as exc:
        print(f"\nERRO: {exc}\n", file=sys.stderr)
        return 1


def _executar_linha_de_comando() -> int:
    cfg = criar_parser().parse_args()
    print(INSTRUCOES_AUTENTICACAO)

    if ee is None:
        falhar("A biblioteca earthengine-api não está instalada. "
               "Rode: pip install -r requirements.txt")

    if cfg.detalhe:
        cfg.sensor = "sentinel2"
    if cfg.fim is None:
        cfg.fim = ano_final_padrao(cfg.meses)
    if cfg.sensor == "sentinel2" and cfg.inicio < SENTINEL2_PRIMEIRO_ANO:
        print(f"AVISO: Sentinel-2 selecionado. O satélite opera desde 2015, mas a coleção de "
              f"superfície no Earth Engine só tem cobertura consistente a partir de "
              f"{SENTINEL2_PRIMEIRO_ANO}. O período fica menor: {SENTINEL2_PRIMEIRO_ANO}–{cfg.fim} "
              f"(em troca, 10 m de resolução em vez de 30 m).\n")
        cfg.inicio = SENTINEL2_PRIMEIRO_ANO
    if cfg.inicio > cfg.fim:
        falhar(f"Ano inicial ({cfg.inicio}) maior que o final ({cfg.fim}).")

    grupos = carregar_geojson(cfg.geojson, cfg.campo)
    if cfg.codigo is not None:
        if cfg.codigo not in grupos:
            falhar(f"Fazenda '{cfg.codigo}' não encontrada no campo '{cfg.campo}'.")
        codigos = [cfg.codigo]
    else:
        codigos = sorted(grupos, key=lambda c: (len(c), c))
        if cfg.limite:
            codigos = codigos[:cfg.limite]

    inicializar_earth_engine(cfg.projeto)

    meses_txt = f"{cfg.meses[0]:02d}–{cfg.meses[1]:02d}"
    print(f"Sensor: {cfg.sensor} | anos {cfg.inicio}–{cfg.fim} | meses {meses_txt} | "
          f"{len(codigos)} fazenda(s)\n")

    # No lote, cada fazenda é gravada no relatório assim que termina (modo
    # acréscimo): uma interrupção no meio das 613 não perde o que já foi feito,
    # e rodadas de retomada acumulam histórico em vez de sobrescrever.
    caminho_csv = cfg.saida / "relatorio_lote.csv"
    if cfg.todas:
        cfg.saida.mkdir(parents=True, exist_ok=True)

    ok = 0
    for i, codigo in enumerate(codigos, 1):
        print(f"[{i}/{len(codigos)}] Fazenda {codigo}")
        try:
            relatorio = gerar_fazenda(codigo, grupos[codigo], cfg)
        except Exception as exc:  # no lote, uma falha não interrompe as demais
            print(f"  ERRO: {exc}")
            relatorio = {"codigo": codigo, "status": f"erro: {exc}", "anos": "",
                         "cenas_por_ano": "", "avisos": [], "gif": "", "mp4": ""}
            if not cfg.todas:
                return 1
        if relatorio["status"] == "ok":
            ok += 1
        if cfg.todas:
            registrar_no_relatorio(caminho_csv, relatorio)

    if cfg.todas:
        print(f"\nLote concluído: {ok} gerada(s) de {len(codigos)}. Relatório: {caminho_csv}")

    return 0


CAMPOS_RELATORIO = ["executado_em", "codigo", "status", "anos", "cenas_por_ano",
                    "avisos", "gif", "mp4"]


def registrar_no_relatorio(caminho_csv: Path, relatorio: dict) -> None:
    novo = not caminho_csv.exists()
    with caminho_csv.open("a", newline="", encoding="utf-8-sig" if novo else "utf-8") as arq:
        escritor = csv.DictWriter(arq, fieldnames=CAMPOS_RELATORIO, delimiter=";")
        if novo:
            escritor.writeheader()
        escritor.writerow({
            **relatorio,
            "executado_em": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "avisos": " | ".join(relatorio["avisos"]),
        })


if __name__ == "__main__":
    sys.exit(main())


# ---------------------------------------------------------------------------
# CONFERIR NA DOCUMENTAÇÃO OFICIAL (itens cuja assinatura/valor pode ter mudado)
# ---------------------------------------------------------------------------
# 1. geemap.add_text_to_gif — nomes dos parâmetros (xy, text_sequence, font_type,
#    font_size, font_color, add_progress_bar, progress_bar_color,
#    progress_bar_height, duration, loop). Se mudarem, o script cai no Pillow.
# 2. ee.ImageCollection.getVideoThumbURL — chaves aceitas (dimensions, region,
#    framesPerSecond, crs) e o limite de tamanho do vídeo gerado.
# 3. Landsat Collection 2 Level-2 — bits do QA_PIXEL (0–5) e o fator de escala
#    0.0000275 / -0.2 das bandas SR_B*.
# 4. COPERNICUS/S2_SR_HARMONIZED — data de início efetiva da cobertura na região.
# 5. GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED — nome da banda cs_cdf, limiar
#    recomendado e o método ee.ImageCollection.linkCollection.
# 6. Autenticação — comando `earthengine authenticate` e ee.Initialize(project=...).
# 7. imageio.v2.get_writer com o plugin imageio-ffmpeg — parâmetros codec,
#    pixelformat e macro_block_size.
