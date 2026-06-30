'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LayerGroupWithLayersRow } from '@/lib/types/database';

interface LayerGroupEditorProps {
  clientId: string;
  initialGroups: LayerGroupWithLayersRow[];
}

export function LayerGroupEditor({ clientId, initialGroups }: LayerGroupEditorProps) {
  const router = useRouter();
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupTitle.trim()) return;
    setCreating(true);
    await fetch('/api/admin/layer-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, title: newGroupTitle.trim() }),
    });
    setCreating(false);
    setNewGroupTitle('');
    router.refresh();
  }

  async function deleteGroup(id: string) {
    if (!confirm('Excluir este grupo e todas as suas camadas?')) return;
    await fetch('/api/admin/layer-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  async function moveGroup(group: LayerGroupWithLayersRow, direction: -1 | 1) {
    const idx = initialGroups.findIndex((g) => g.id === group.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= initialGroups.length) return;
    const other = initialGroups[swapIdx];
    await fetch('/api/admin/layer-groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groups: [
          { id: group.id, sortOrder: other.sort_order },
          { id: other.id, sortOrder: group.sort_order },
        ],
      }),
    });
    router.refresh();
  }

  async function moveLayer(groupLayers: LayerGroupWithLayersRow['layers'], layerId: string, direction: -1 | 1) {
    const idx = groupLayers.findIndex((l) => l.id === layerId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= groupLayers.length) return;
    const a = groupLayers[idx];
    const b = groupLayers[swapIdx];
    await fetch('/api/admin/layers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layers: [
          { id: a.id, sortOrder: b.sort_order },
          { id: b.id, sortOrder: a.sort_order },
        ],
      }),
    });
    router.refresh();
  }

  async function deleteLayer(id: string) {
    if (!confirm('Excluir esta camada?')) return;
    await fetch('/api/admin/layers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  async function toggleDefaultActive(id: string, current: boolean) {
    await fetch('/api/admin/layers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, defaultActive: !current }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createGroup} className="flex gap-2">
        <input
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          placeholder="Título do novo grupo (ex: Recursos Hídricos)"
          value={newGroupTitle}
          onChange={(e) => setNewGroupTitle(e.target.value)}
        />
        <button
          disabled={creating}
          className="rounded-md bg-lime-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
        >
          + Grupo
        </button>
      </form>

      {initialGroups.map((group) => (
        <div key={group.id} className="rounded-lg border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{group.title}</h2>
            <div className="flex gap-2 text-xs text-zinc-400">
              <button onClick={() => moveGroup(group, -1)} className="hover:text-white">
                ↑
              </button>
              <button onClick={() => moveGroup(group, 1)} className="hover:text-white">
                ↓
              </button>
              <button onClick={() => deleteGroup(group.id)} className="text-red-400 hover:text-red-300">
                Excluir grupo
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {group.layers.map((layer) => (
              <div
                key={layer.id}
                className="flex items-center justify-between rounded bg-white/5 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border border-white/20"
                    style={{ backgroundColor: layer.style?.color || '#3388ff' }}
                  />
                  <span>{layer.label}</span>
                  <span className="text-xs text-zinc-500">
                    ({layer.layer_key}
                    {layer.feature_count != null ? ` · ${layer.feature_count} feições` : ''})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={layer.default_active}
                      onChange={() => toggleDefaultActive(layer.id, layer.default_active)}
                    />
                    ativa por padrão
                  </label>
                  <button onClick={() => moveLayer(group.layers, layer.id, -1)} className="hover:text-white">
                    ↑
                  </button>
                  <button onClick={() => moveLayer(group.layers, layer.id, 1)} className="hover:text-white">
                    ↓
                  </button>
                  <button onClick={() => deleteLayer(layer.id)} className="text-red-400 hover:text-red-300">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {group.layers.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhuma camada neste grupo ainda. Use a página de upload.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
