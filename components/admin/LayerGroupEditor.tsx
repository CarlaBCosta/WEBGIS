'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LayerGroupTemplateRow, LayerGroupWithLayersRow } from '@/lib/types/database';

interface LayerGroupEditorProps {
  clientId: string;
  initialGroups: LayerGroupWithLayersRow[];
  templates: LayerGroupTemplateRow[];
}

const inputClass =
  'rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
  'placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none';

export function LayerGroupEditor({ clientId, initialGroups, templates }: LayerGroupEditorProps) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [editando, setEditando] = useState<{ id: string; title: string; descricao: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: string; destino: string } | null>(null);

  // Divisões do modelo que este cliente ainda não tem (incluídas ou excluídas antes).
  const vindas = new Set(initialGroups.map((g) => g.template_id).filter(Boolean));
  const titulos = new Set(initialGroups.map((g) => g.title));
  const faltando = templates.filter((t) => !vindas.has(t.id) && !titulos.has(t.title));

  async function chamar(url: string, metodo: string, corpo: unknown): Promise<boolean> {
    setOcupado(true);
    setErro('');
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    setOcupado(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.error || 'Não foi possível salvar.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function criarPropria(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    if (await chamar('/api/admin/layer-groups', 'POST', { clientId, title: novoTitulo, descricao: novaDescricao })) {
      setNovoTitulo('');
      setNovaDescricao('');
    }
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (await chamar('/api/admin/layer-groups', 'PATCH', editando)) setEditando(null);
  }

  async function excluirDivisao(group: LayerGroupWithLayersRow) {
    if (group.layers.length === 0) {
      if (!confirm(`Excluir a divisão "${group.title}" deste cliente?`)) return;
      await chamar('/api/admin/layer-groups', 'DELETE', { id: group.id });
      return;
    }
    const outra = initialGroups.find((g) => g.id !== group.id);
    if (!outra) {
      setErro('Crie ou inclua outra divisão para receber as camadas antes de excluir esta.');
      return;
    }
    setExcluindo({ id: group.id, destino: outra.id });
  }

  async function confirmarExclusaoComMover() {
    if (!excluindo) return;
    if (await chamar('/api/admin/layer-groups', 'DELETE', { id: excluindo.id, moverPara: excluindo.destino })) {
      setExcluindo(null);
    }
  }

  async function moverDivisao(group: LayerGroupWithLayersRow, direcao: -1 | 1) {
    const idx = initialGroups.findIndex((g) => g.id === group.id);
    const outra = initialGroups[idx + direcao];
    if (!outra) return;
    await chamar('/api/admin/layer-groups', 'PATCH', {
      groups: [
        { id: group.id, sortOrder: outra.sort_order },
        { id: outra.id, sortOrder: group.sort_order },
      ],
    });
  }

  async function moverCamada(camadas: LayerGroupWithLayersRow['layers'], layerId: string, direcao: -1 | 1) {
    const idx = camadas.findIndex((l) => l.id === layerId);
    const a = camadas[idx];
    const b = camadas[idx + direcao];
    if (!b) return;
    await chamar('/api/admin/layers', 'PATCH', {
      layers: [
        { id: a.id, sortOrder: b.sort_order },
        { id: b.id, sortOrder: a.sort_order },
      ],
    });
  }

  async function excluirCamada(id: string) {
    if (!confirm('Excluir esta camada?')) return;
    await chamar('/api/admin/layers', 'DELETE', { id });
  }

  return (
    <div className="space-y-6">
      {/* Divisões do modelo ainda não incluídas */}
      <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Modelo de divisões</h2>
            <p className="text-xs text-zinc-500">
              Todo cliente novo recebe as divisões do modelo. Aqui você inclui ou exclui só para este cliente.{' '}
              <Link href="/admin/modelo-divisoes" className="text-lime-400 hover:underline">
                Editar o modelo
              </Link>
            </p>
          </div>
          {faltando.length > 1 && (
            <button
              disabled={ocupado}
              onClick={() => chamar('/api/admin/layer-groups', 'POST', { clientId, carregarModelo: true })}
              className="rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
            >
              Incluir todas ({faltando.length})
            </button>
          )}
        </div>
        {faltando.length === 0 ? (
          <p className="text-xs text-lime-300/80">✓ Todas as divisões do modelo estão neste cliente.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {faltando.map((t) => (
              <button
                key={t.id}
                disabled={ocupado}
                title={t.descricao}
                onClick={() => chamar('/api/admin/layer-groups', 'POST', { clientId, templateId: t.id })}
                className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-zinc-300 hover:border-lime-400/60 hover:text-lime-300 disabled:opacity-50"
              >
                + {t.title}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Divisão própria */}
      <form onSubmit={criarPropria} className="flex flex-wrap gap-2">
        <input
          className={`${inputClass} min-w-56`}
          placeholder="Nova divisão só deste cliente (ex: Recursos Hídricos)"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
        />
        <input
          className={`${inputClass} min-w-72 flex-1`}
          placeholder="Descrição: camadas que entram nela (opcional)"
          value={novaDescricao}
          onChange={(e) => setNovaDescricao(e.target.value)}
        />
        <button
          disabled={ocupado || !novoTitulo.trim()}
          className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
        >
          + Divisão
        </button>
      </form>

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {initialGroups.length === 0 && (
        <p className="text-sm text-zinc-500">Este cliente ainda não tem divisões. Inclua as do modelo acima.</p>
      )}

      {initialGroups.map((group, gi) => (
        <div key={group.id} className="rounded-xl border border-white/10 bg-zinc-900/30 p-4">
          {editando?.id === group.id ? (
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className={`${inputClass} min-w-56`}
                value={editando.title}
                onChange={(e) => setEditando({ ...editando, title: e.target.value })}
                aria-label="Nome da divisão"
              />
              <input
                className={`${inputClass} min-w-72 flex-1`}
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                placeholder="Descrição"
                aria-label="Descrição da divisão"
              />
              <button
                onClick={salvarEdicao}
                disabled={ocupado}
                className="rounded-lg bg-lime-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
              >
                Salvar
              </button>
              <button onClick={() => setEditando(null)} className="px-2 text-xs text-zinc-400 hover:text-white">
                Cancelar
              </button>
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 font-medium text-zinc-100">
                  {group.title}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      group.template_id ? 'bg-lime-400/10 text-lime-300' : 'bg-sky-500/10 text-sky-300'
                    }`}
                  >
                    {group.template_id ? 'do modelo' : 'só deste cliente'}
                  </span>
                  <span className="text-xs font-normal text-zinc-500">
                    {group.layers.length} camada{group.layers.length === 1 ? '' : 's'}
                  </span>
                </h2>
                {group.descricao && <p className="mt-0.5 text-xs text-zinc-500">{group.descricao}</p>}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <button onClick={() => moverDivisao(group, -1)} disabled={gi === 0} className="hover:text-white disabled:opacity-30" aria-label="Subir divisão">
                  ↑
                </button>
                <button
                  onClick={() => moverDivisao(group, 1)}
                  disabled={gi === initialGroups.length - 1}
                  className="hover:text-white disabled:opacity-30"
                  aria-label="Descer divisão"
                >
                  ↓
                </button>
                <button
                  onClick={() => setEditando({ id: group.id, title: group.title, descricao: group.descricao ?? '' })}
                  className="hover:text-white"
                >
                  Editar
                </button>
                <button onClick={() => excluirDivisao(group)} className="text-red-400 hover:text-red-300">
                  Excluir divisão
                </button>
              </div>
            </div>
          )}

          {excluindo?.id === group.id && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-zinc-300">
              <span>Mover as {group.layers.length} camadas para</span>
              <select
                value={excluindo.destino}
                onChange={(e) => setExcluindo({ ...excluindo, destino: e.target.value })}
                className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs"
              >
                {initialGroups
                  .filter((g) => g.id !== group.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
              <span>e excluir a divisão?</span>
              <button
                onClick={confirmarExclusaoComMover}
                disabled={ocupado}
                className="rounded-md bg-red-500/80 px-2.5 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Mover e excluir
              </button>
              <button onClick={() => setExcluindo(null)} className="text-zinc-400 hover:text-white">
                Cancelar
              </button>
            </div>
          )}

          <div className="space-y-1">
            {group.layers.map((layer, li) => (
              <div
                key={layer.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/20"
                    style={{ backgroundColor: layer.style?.color || '#3388ff' }}
                  />
                  <span className="truncate">{layer.label}</span>
                  <span className="truncate text-xs text-zinc-500">
                    ({layer.layer_key}
                    {layer.feature_count != null ? ` · ${layer.feature_count} feições` : ''})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <select
                    value={group.id}
                    disabled={ocupado}
                    onChange={(e) => chamar('/api/admin/layers', 'PATCH', { id: layer.id, groupId: e.target.value })}
                    className="max-w-44 rounded-md border border-white/10 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-300"
                    aria-label={`Mover ${layer.label} para outra divisão`}
                    title="Mover para outra divisão"
                  >
                    {initialGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={layer.default_active}
                      onChange={() => chamar('/api/admin/layers', 'PATCH', { id: layer.id, defaultActive: !layer.default_active })}
                    />
                    ativa por padrão
                  </label>
                  <button onClick={() => moverCamada(group.layers, layer.id, -1)} disabled={li === 0} className="hover:text-white disabled:opacity-30" aria-label="Subir camada">
                    ↑
                  </button>
                  <button
                    onClick={() => moverCamada(group.layers, layer.id, 1)}
                    disabled={li === group.layers.length - 1}
                    className="hover:text-white disabled:opacity-30"
                    aria-label="Descer camada"
                  >
                    ↓
                  </button>
                  <button onClick={() => excluirCamada(layer.id)} className="text-red-400 hover:text-red-300">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {group.layers.length === 0 && (
              <p className="text-xs text-zinc-500">
                Nenhuma camada nesta divisão ainda. Divisões vazias não aparecem no portal.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
