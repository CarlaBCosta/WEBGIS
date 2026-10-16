'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MutConfigRow } from '@/lib/types/database';
import type { CamposMut } from '@/lib/mut';
import { VALORES_ELEGIVEL_PADRAO } from '@/lib/mut';

interface MutCardProps {
  clientId: string;
  layers: { layer_key: string; label: string }[];
  config: MutConfigRow | null;
  // Camada e campos identificados pelo servidor no arquivo enviado.
  sugestao: { layerKey: string; campos: string[]; detectado: CamposMut } | null;
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
  ativo: boolean;
};

function inicial(config: MutConfigRow | null, sugestao: MutCardProps['sugestao']): Rascunho {
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
      ativo: config.ativo,
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
    ativo: true,
  };
}

export function MutCard({ clientId, layers, config, sugestao }: MutCardProps) {
  const router = useRouter();
  const [form, setForm] = useState<Rascunho>(() => inicial(config, sugestao));
  const [campos, setCampos] = useState<string[]>(sugestao?.campos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvo, setSalvo] = useState(false);

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

  async function salvar() {
    setSalvando(true);
    setErro('');
    setAviso('');
    setSalvo(false);
    const res = await fetch('/api/admin/mut', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ...form, anoInicial: Number(form.anoInicial) }),
    });
    setSalvando(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(body.error || 'Não foi possível salvar a visão MUT.');
      return;
    }
    setSalvo(true);
    if (body.semUso) {
      setAviso(
        'Salvo. A camada ainda não tem o campo de uso do solo: no portal a visão MUT vai mostrar só a elegibilidade.'
      );
    }
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
    setForm(inicial(null, sugestao));
    setSalvo(false);
    router.refresh();
  }

  const listaCampos = campos.length > 0 ? campos : null;

  function campoTexto(
    rotulo: string,
    chave: keyof Rascunho,
    opcional = false,
    placeholder?: string
  ) {
    return (
      <label className="block min-w-0">
        <span className="mb-1 block text-xs text-zinc-500">
          {rotulo}
          {opcional && <span className="text-zinc-600"> (opcional)</span>}
        </span>
        <input
          list={listaCampos ? 'campos-mut' : undefined}
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
        </>
      )}
    </section>
  );
}
