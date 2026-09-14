'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TimelapseJobRow, TimelapseRoboRow, TimelapseJobStatus } from '@/lib/types/database';
import { CAMPO_FAZENDA_PADRAO, ROBO_ONLINE_MS, sugerirCamadaFazendas } from '@/lib/timelapse';

interface TimelapseCardProps {
  clientId: string;
  layers: { layer_key: string; label: string }[];
  farmCodeFields: string[];
}

const ROTULO_STATUS: Record<TimelapseJobStatus, { texto: string; classe: string }> = {
  pendente: { texto: 'Na fila', classe: 'bg-amber-500/10 text-amber-300' },
  processando: { texto: 'Gerando', classe: 'bg-sky-500/10 text-sky-300' },
  concluido: { texto: 'Concluído', classe: 'bg-lime-400/10 text-lime-300' },
  erro: { texto: 'Erro', classe: 'bg-red-500/10 text-red-400' },
  cancelado: { texto: 'Cancelado', classe: 'bg-zinc-500/10 text-zinc-400' },
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
  'focus:border-lime-400/60 focus:outline-none disabled:opacity-50';

export function TimelapseCard({ clientId, layers, farmCodeFields }: TimelapseCardProps) {
  const [layerKey, setLayerKey] = useState(
    sugerirCamadaFazendas(layers.map((l) => l.layer_key)) ?? layers[0]?.layer_key ?? ''
  );
  const [campo, setCampo] = useState(farmCodeFields[0] ?? CAMPO_FAZENDA_PADRAO);
  const [sensor, setSensor] = useState<'landsat' | 'sentinel2'>('landsat');
  const [job, setJob] = useState<TimelapseJobRow | null>(null);
  const [robo, setRobo] = useState<TimelapseRoboRow | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const atualizar = useCallback(async () => {
    const res = await fetch(`/api/admin/timelapse-jobs?clientId=${clientId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    setJob(body.job);
    setRobo(body.robo);
    setAgora(Date.now());
  }, [clientId]);

  useEffect(() => {
    atualizar();
    const timer = setInterval(atualizar, 5000);
    return () => clearInterval(timer);
  }, [atualizar]);

  const emAndamento = job?.status === 'pendente' || job?.status === 'processando';
  const roboOnline = !!robo?.ultimo_sinal && agora - new Date(robo.ultimo_sinal).getTime() < ROBO_ONLINE_MS;

  async function gerar() {
    setEnviando(true);
    setErro('');
    const res = await fetch('/api/admin/timelapse-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, layerKey, campo, sensor }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.error || 'Não foi possível criar o pedido.');
      return;
    }
    atualizar();
  }

  async function cancelar() {
    if (!job) return;
    await fetch('/api/admin/timelapse-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id }),
    });
    atualizar();
  }

  const feitas = (job?.concluidas ?? 0) + (job?.falhas ?? 0);
  const percentual = job?.total ? Math.round((feitas / job.total) * 100) : 0;

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Timelapses das fazendas</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Um vídeo de satélite por fazenda (2007 → ano mais recente), gerado pelo robô.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            roboOnline ? 'bg-lime-400/10 text-lime-300' : 'bg-red-500/10 text-red-400'
          }`}
          title={robo?.maquina ? `Máquina: ${robo.maquina}` : undefined}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${roboOnline ? 'bg-lime-400' : 'bg-red-400'}`} aria-hidden />
          {roboOnline ? 'Robô online' : 'Robô offline'}
        </span>
      </div>

      {layers.length === 0 ? (
        <p className="text-sm text-zinc-400">Envie as camadas do cliente antes de gerar timelapses.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Camada das fazendas</span>
            <select value={layerKey} onChange={(e) => setLayerKey(e.target.value)} disabled={emAndamento} className={inputClass}>
              {layers.map((l) => (
                <option key={l.layer_key} value={l.layer_key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Campo do código</span>
            <input value={campo} onChange={(e) => setCampo(e.target.value)} disabled={emAndamento} className={`${inputClass} font-mono`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Satélite</span>
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value as 'landsat' | 'sentinel2')}
              disabled={emAndamento}
              className={inputClass}
            >
              <option value="landsat">Landsat (2007+, 30 m)</option>
              <option value="sentinel2">Sentinel-2 (2017+, 10 m)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={gerar}
            disabled={enviando || emAndamento || !layerKey || !campo.trim()}
            className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Gerar timelapses'}
          </button>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}

      {job && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROTULO_STATUS[job.status].classe}`}>
              {ROTULO_STATUS[job.status].texto}
            </span>
            <span className="text-zinc-400">
              {job.layer_key} · {job.sensor === 'sentinel2' ? 'Sentinel-2' : 'Landsat'}
              {job.criado_por ? ` · pedido por ${job.criado_por}` : ''}
            </span>
            {emAndamento && (
              <button type="button" onClick={cancelar} className="ml-auto text-xs text-zinc-500 hover:text-red-400">
                cancelar
              </button>
            )}
          </div>

          {job.total ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${percentual}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {feitas} de {job.total} fazendas ({percentual}%) · {job.concluidas} prontas
                {job.falhas > 0 && <span className="text-red-400"> · {job.falhas} com falha</span>}
              </p>
            </>
          ) : (
            job.status === 'pendente' && (
              <p className="text-xs text-zinc-500">
                {roboOnline
                  ? 'Aguardando o robô começar...'
                  : 'O robô está desligado: o pedido começa assim que ele for ligado.'}
              </p>
            )
          )}

          {job.mensagem && !emAndamento && <p className="mt-2 text-xs text-zinc-400">{job.mensagem}</p>}
        </div>
      )}
    </section>
  );
}
