'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LayerGroupRow } from '@/lib/types/database';

interface GeojsonUploadFormProps {
  slug: string;
  groups: LayerGroupRow[];
}

export function GeojsonUploadForm({ slug, groups }: GeojsonUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [layerKey, setLayerKey] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#3388FF');
  const [fillOpacity, setFillOpacity] = useState(0.3);
  const [weight, setWeight] = useState(2);
  const [radius, setRadius] = useState(6);
  const [defaultActive, setDefaultActive] = useState(false);
  const [reproject, setReproject] = useState(false);
  const [toleranceMeters, setToleranceMeters] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ keptCount: number; originalCount: number } | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !layerKey || !label || !groupId) return;
    setSubmitting(true);
    setError('');
    setResult(null);

    const style = { color, fillColor: color, fillOpacity, weight, radius };
    const legendStyle = `background-color: ${color};`;

    const form = new FormData();
    form.set('file', file);
    form.set('slug', slug);
    form.set('groupId', groupId);
    form.set('layerKey', layerKey);
    form.set('label', label);
    form.set('legendStyle', legendStyle);
    form.set('style', JSON.stringify(style));
    form.set('defaultActive', String(defaultActive));
    form.set('sourceCrs', reproject ? 'EPSG:31982' : 'EPSG:4326');
    form.set('toleranceMeters', String(toleranceMeters));

    const res = await fetch('/api/admin/upload-geojson', { method: 'POST', body: form });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erro ao enviar.');
      return;
    }

    const body = await res.json();
    setResult({ keptCount: body.keptCount, originalCount: body.originalCount });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Arquivo .geojson</label>
        <input
          type="file"
          accept=".geojson,application/geo+json,application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Grupo</label>
        <select
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Identificador da camada (layer_key)</label>
          <input
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={layerKey}
            onChange={(e) => setLayerKey(e.target.value)}
            placeholder="ex: Usina_Principal"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Rótulo exibido</label>
          <input
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: Usina Principal"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Cor</label>
          <input type="color" className="h-9 w-full rounded border border-white/10 bg-zinc-900" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Opacidade</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={fillOpacity}
            onChange={(e) => setFillOpacity(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Espessura</label>
          <input
            type="number"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Raio (pontos)</label>
          <input
            type="number"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={defaultActive} onChange={(e) => setDefaultActive(e.target.checked)} />
          Ativa por padrão
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reproject} onChange={(e) => setReproject(e.target.checked)} />
          Reprojetar de EPSG:31982 (SIRGAS 2000 / UTM 22S)
        </label>
        <label className="flex items-center gap-2">
          Tolerância de simplificação (m)
          <input
            type="number"
            className="w-20 rounded-md border border-white/10 bg-zinc-900 px-2 py-1"
            value={toleranceMeters}
            onChange={(e) => setToleranceMeters(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <p className="text-sm text-lime-400">
          Camada publicada: {result.keptCount} de {result.originalCount} feições mantidas.
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
      >
        {submitting ? 'Enviando...' : 'Enviar e publicar'}
      </button>
    </form>
  );
}
