'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MutConfigRow } from '@/lib/types/database';
import type { CamposFazenda, CamposMut } from '@/lib/mut';
import { VALORES_ELEGIVEL_PADRAO } from '@/lib/mut';

interface MutCardProps {
  clientId: string;
  layers: { layer_key: string; label: string }[];
  config: MutConfigRow | null;
  // Quantas linhas do CSV de índices de vegetação já foram importadas.
  linhasIndices: number;
  // Camada e campos identificados pelo servidor no arquivo enviado.
  sugestao: { layerKey: string; campos: string[]; detectado: CamposMut } | null;
  // Camada das fazendas (Atlas) identificada pelo servidor.
  sugestaoAtlas: { layerKey: string; campos: string[]; detectado: CamposFazenda } | null;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
  'placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none disabled:opacity-50';

type Rascunho = {
  layerKey: string;
  campoCodigo: string;
  campoTalhao: string;
  campoArea: string;
  campoElegibilidade: string;
  valoresElegivel: string;
  campoUso: string;
  nomeFazenda: string;
  safra: string;
  anoInicial: string;
  anoMut: string;
  ativo: boolean;
  layerFazendas: string;
  campoCodigoFazenda: string;
  campoNome: string;
  campoAreaFazenda: string;
  campoPeriodo: string;
  campoLatLong: string;
  campoElegibilidadeFazenda: string;
};

function inicial(
  config: MutConfigRow | null,
  sugestao: MutCardProps['sugestao'],
  atlas: MutCardProps['sugestaoAtlas']
): Rascunho {
  if (config) {
    return {
      layerKey: config.layer_key,
      campoCodigo: config.campo_codigo,
      campoTalhao: config.campo_talhao ?? '',
      campoArea: config.campo_area ?? '',
      campoElegibilidade: config.campo_elegibilidade,
      valoresElegivel: (config.valores_elegivel ?? VALORES_ELEGIVEL_PADRAO).join(', '),
      campoUso: config.campo_uso ?? '',
      nomeFazenda: config.nome_fazenda,
      safra: config.safra,
      anoInicial: String(config.ano_inicial),
      anoMut: String(config.ano_mut ?? 2008),
      ativo: config.ativo,
      layerFazendas: config.layer_fazendas ?? atlas?.layerKey ?? '',
      campoCodigoFazenda: config.campo_codigo_fazenda ?? atlas?.detectado.codigo ?? '',
      campoNome: config.campo_nome ?? atlas?.detectado.nome ?? '',
      campoAreaFazenda: config.campo_area_fazenda ?? atlas?.detectado.area ?? '',
      campoPeriodo: config.campo_periodo ?? atlas?.detectado.periodo ?? '',
      campoLatLong: config.campo_latlong ?? atlas?.detectado.latlong ?? '',
      campoElegibilidadeFazenda:
        config.campo_elegibilidade_fazenda ?? atlas?.detectado.elegibilidade ?? '',
    };
  }
  const d = sugestao?.detectado;
  return {
    layerKey: sugestao?.layerKey ?? '',
    campoCodigo: d?.codigo ?? '',
    campoTalhao: d?.talhao ?? '',
    campoArea: d?.area ?? '',
    campoElegibilidade: d?.elegibilidade ?? '',
    valoresElegivel: VALORES_ELEGIVEL_PADRAO.join(', '),
    campoUso: d?.uso ?? '',
    nomeFazenda: '',
    safra: '',
    anoInicial: '2007',
    anoMut: '2008',
    ativo: true,
    layerFazendas: atlas?.layerKey ?? '',
    campoCodigoFazenda: atlas?.detectado.codigo ?? '',
    campoNome: atlas?.detectado.nome ?? '',
    campoAreaFazenda: atlas?.detectado.area ?? '',
    campoPeriodo: atlas?.detectado.periodo ?? '',
    campoLatLong: atlas?.detectado.latlong ?? '',
    campoElegibilidadeFazenda: atlas?.detectado.elegibilidade ?? '',
  };
}

export function MutCard({
  clientId,
  layers,
  config,
  sugestao,
  sugestaoAtlas,
  linhasIndices,
}: MutCardProps) {
  const router = useRouter();
  const [form, setForm] = useState<Rascunho>(() => inicial(config, sugestao, sugestaoAtlas));
  const [campos, setCampos] = useState<string[]>(sugestao?.campos ?? []);
  const [camposAtlas, setCamposAtlas] = useState<string[]>(sugestaoAtlas?.campos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvo, setSalvo] = useState(false);

  // Importação do CSV de índices de vegetação (o gráfico do painel da fazenda).
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Contagem vinda do servidor, substituída pela local depois de importar.
  const [linhasLocal, setLinhasLocal] = useState<number | null>(null);
  const linhas = linhasLocal ?? linhasIndices;
  const [importando, setImportando] = useState(false);
  const [resultadoCsv, setResultadoCsv] = useState('');
  const [erroCsv, setErroCsv] = useState('');

  const contarIndices = useCallback(async () => {
    const res = await fetch(`/api/admin/mut-indices?clientId=${clientId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    setLinhasLocal(body.linhas ?? 0);
  }, [clientId]);

  async function importarCsv(arquivo: File) {
    setImportando(true);
    setErroCsv('');
    setResultadoCsv('');
    const corpo = new FormData();
    corpo.set('file', arquivo);
    corpo.set('clientId', clientId);
    const res = await fetch('/api/admin/mut-indices', { method: 'POST', body: corpo });
    setImportando(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErroCsv(body.error || 'Não foi possível importar o arquivo.');
      return;
    }
    setResultadoCsv(
      `${body.linhas.toLocaleString('pt-BR')} linhas de ${body.fazendas} fazendas e ${body.classes} classes.` +
        (body.ignoradas ? ` ${body.ignoradas} linhas ignoradas (sem data ou sem fazenda).` : '')
    );
    contarIndices();
  }

  async function removerIndices() {
    setImportando(true);
    await fetch('/api/admin/mut-indices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    setImportando(false);
    setResultadoCsv('');
    contarIndices();
  }

  const mudar = (parcial: Partial<Rascunho>) => setForm((f) => ({ ...f, ...parcial }));

  // Ao trocar de camada, relê os atributos do arquivo e repreenche os campos.
  async function trocarCamada(layerKey: string) {
    mudar({ layerKey });
    setErro('');
    setSalvo(false);
    const res = await fetch('/api/admin/mut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, layerKey }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setCampos(body.campos ?? []);
    const d: CamposMut = body.detectado ?? {};
    mudar({
      campoCodigo: d.codigo ?? '',
      campoTalhao: d.talhao ?? '',
      campoArea: d.area ?? '',
      campoElegibilidade: d.elegibilidade ?? '',
      campoUso: d.uso ?? '',
    });
  }

  // Ao trocar a camada das fazendas, relê os atributos e repreenche os campos.
  async function trocarAtlas(layerKey: string) {
    mudar({ layerFazendas: layerKey });
    setErro('');
    setSalvo(false);
    if (!layerKey) {
      setCamposAtlas([]);
      mudar({
        campoCodigoFazenda: '',
        campoNome: '',
        campoAreaFazenda: '',
        campoPeriodo: '',
        campoLatLong: '',
        campoElegibilidadeFazenda: '',
      });
      return;
    }
    const res = await fetch('/api/admin/mut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, layerKey, tipo: 'fazendas' }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setCamposAtlas(body.campos ?? []);
    const d: CamposFazenda = body.detectado ?? {};
    mudar({
      campoCodigoFazenda: d.codigo ?? '',
      campoNome: d.nome ?? '',
      campoAreaFazenda: d.area ?? '',
      campoPeriodo: d.periodo ?? '',
      campoLatLong: d.latlong ?? '',
      campoElegibilidadeFazenda: d.elegibilidade ?? '',
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    setAviso('');
    setSalvo(false);
    const res = await fetch('/api/admin/mut', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        ...form,
        anoInicial: Number(form.anoInicial),
        anoMut: Number(form.anoMut),
      }),
    });
    setSalvando(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(body.error || 'Não foi possível salvar a visão MUT.');
      return;
    }
    setSalvo(true);
    const avisos: string[] = [];
    if (Array.isArray(body.ausentes) && body.ausentes.length > 0) {
      avisos.push(
        `A camada ainda não tem: ${body.ausentes.join(', ')}. O portal mostra só o que existe hoje; ` +
          'reenvie a camada com esses campos quando tiver.'
      );
    } else if (body.semUso) {
      avisos.push(
        'A camada ainda não tem o campo de uso do solo: no portal a visão MUT vai mostrar só a elegibilidade.'
      );
    }
    if (avisos.length) setAviso(`Salvo. ${avisos.join(' ')}`);
    router.refresh();
  }

  async function remover() {
    setSalvando(true);
    await fetch('/api/admin/mut', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    setSalvando(false);
    setForm(inicial(null, sugestao, sugestaoAtlas));
    setSalvo(false);
    router.refresh();
  }

  const listaCampos = campos.length > 0 ? campos : null;

  function campoTexto(
    rotulo: string,
    chave: keyof Rascunho,
    opcional = false,
    placeholder?: string,
    lista = 'campos-mut'
  ) {
    const temLista = lista === 'campos-mut' ? !!listaCampos : camposAtlas.length > 0;
    return (
      <label className="block min-w-0">
        <span className="mb-1 block text-xs text-zinc-500">
          {rotulo}
          {opcional && <span className="text-zinc-600"> (opcional)</span>}
        </span>
        <input
          list={temLista ? lista : undefined}
          value={String(form[chave])}
          onChange={(e) => mudar({ [chave]: e.target.value } as Partial<Rascunho>)}
          placeholder={placeholder}
          className={`${inputClass} font-mono`}
        />
      </label>
    );
  }

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/20">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">Visão MUT</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Mudança do uso do solo: os talhões ficam verdes (elegível) ou vermelhos (inelegível), com os dados
          aparecendo ao passar o mouse. Substitui a prancha do QGIS no portal.
        </p>
      </div>

      {layers.length === 0 ? (
        <p className="text-sm text-zinc-400">Envie as camadas do cliente antes de configurar a visão MUT.</p>
      ) : (
        <>
          {listaCampos && (
            <datalist id="campos-mut">
              {listaCampos.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
          {camposAtlas.length > 0 && (
            <datalist id="campos-atlas">
              {camposAtlas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-1 block text-xs text-zinc-500">Camada MUT</span>
              <select
                value={form.layerKey}
                onChange={(e) => trocarCamada(e.target.value)}
                className={inputClass}
              >
                {!form.layerKey && <option value="">Escolha a camada com os talhões classificados</option>}
                {layers.map((l) => (
                  <option key={l.layer_key} value={l.layer_key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            {campoTexto('Campo do código da fazenda', 'campoCodigo', false, 'FAZENDA')}
            {campoTexto('Campo do talhão', 'campoTalhao', true, 'TALHAO')}
            {campoTexto('Campo da área (ha)', 'campoArea', true, 'AREA')}
            {campoTexto('Campo da elegibilidade', 'campoElegibilidade', false, 'ELEG')}
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-500">Valores que significam elegível</span>
              <input
                value={form.valoresElegivel}
                onChange={(e) => mudar({ valoresElegivel: e.target.value })}
                placeholder="ELEGÍVEL"
                className={`${inputClass} font-mono`}
              />
            </label>
            {campoTexto('Campo do uso do solo', 'campoUso', true, 'USO')}

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-500">Nome da fazenda / projeto</span>
              <input
                value={form.nomeFazenda}
                onChange={(e) => mudar({ nomeFazenda: e.target.value })}
                placeholder="Pacuruxu - Santa Cruz"
                className={inputClass}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-500">Safra</span>
              <input
                value={form.safra}
                onChange={(e) => mudar({ safra: e.target.value })}
                placeholder="2025/26"
                className={inputClass}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-500">Ano de referência do MUT</span>
              <input
                type="number"
                min={1985}
                max={new Date().getFullYear()}
                value={form.anoMut}
                onChange={(e) => mudar({ anoMut: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-500">Ano inicial do timelapse</span>
              <input
                type="number"
                min={1985}
                max={new Date().getFullYear()}
                value={form.anoInicial}
                onChange={(e) => mudar({ anoInicial: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => mudar({ ativo: e.target.checked })}
                className="h-4 w-4 accent-lime-400"
              />
              Mostrar a visão MUT no portal
            </label>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-zinc-200">Camada das fazendas (Atlas)</h3>
            <p className="mt-0.5 mb-3 text-sm text-zinc-500">
              Um polígono por fazenda. É dela que saem a elegibilidade, o nome, o período e as coordenadas
              que aparecem no cabeçalho do painel. Sem ela, a visão mostra só o uso do solo dos talhões.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0 sm:col-span-2">
                <span className="mb-1 block text-xs text-zinc-500">Camada</span>
                <select
                  value={form.layerFazendas}
                  onChange={(e) => trocarAtlas(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sem camada de fazendas</option>
                  {layers.map((l) => (
                    <option key={l.layer_key} value={l.layer_key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.layerFazendas && (
                <>
                  {campoTexto('Campo do código', 'campoCodigoFazenda', false, 'CHAVE_AMB', 'campos-atlas')}
                  {campoTexto('Campo da elegibilidade', 'campoElegibilidadeFazenda', false, 'ELEGIB', 'campos-atlas')}
                  {campoTexto('Campo do nome da fazenda', 'campoNome', true, 'NOME_FAZ', 'campos-atlas')}
                  {campoTexto('Campo da área (ha)', 'campoAreaFazenda', true, 'AREA', 'campos-atlas')}
                  {campoTexto('Campo do período/safra', 'campoPeriodo', true, 'PERIODO', 'campos-atlas')}
                  {campoTexto('Campo das coordenadas', 'campoLatLong', true, 'LATLONG', 'campos-atlas')}
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !form.layerKey}
              className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar visão MUT'}
            </button>
            {config && (
              <button
                type="button"
                onClick={remover}
                disabled={salvando}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                remover configuração
              </button>
            )}
            {salvo && !aviso && <span className="text-sm text-lime-300">Salvo.</span>}
          </div>

          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          {aviso && <p className="mt-3 text-sm text-amber-400/90">{aviso}</p>}
          {!config && !sugestao && (
            <p className="mt-3 text-xs text-amber-400/90">
              Não identifiquei a camada MUT pelos nomes nem pelos atributos. Escolha a camada com os talhões
              classificados e confira os campos.
            </p>
          )}

          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-zinc-200">Gráfico de índices de vegetação</h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              CSV exportado do QGIS com uma linha por fazenda, classe de uso e data (FAZENDA, CLASSE_08,
              Data_Fmt, NDVI, EVI). Cada importação substitui a anterior.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={arquivoRef}
                type="file"
                accept=".csv,text/csv"
                disabled={importando}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) importarCsv(arquivo);
                  e.target.value = '';
                }}
                className="block w-full max-w-sm text-sm text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-lime-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-950 hover:file:bg-lime-400 disabled:opacity-50"
              />
              {linhas > 0 && (
                <button
                  type="button"
                  onClick={removerIndices}
                  disabled={importando}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  remover dados do gráfico
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              {importando
                ? 'Importando...'
                : linhas > 0
                  ? `${linhas.toLocaleString('pt-BR')} medições no banco.`
                  : 'Nenhum dado importado ainda — o painel da fazenda fica sem o gráfico.'}
            </p>
            {resultadoCsv && <p className="mt-1 text-sm text-lime-300">Importado: {resultadoCsv}</p>}
            {erroCsv && <p className="mt-1 text-sm text-red-400">{erroCsv}</p>}
          </div>
        </>
      )}
    </section>
  );
}
