'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRow } from '@/lib/types/database';

interface ClientFormProps {
  initial?: ClientRow;
}

export function ClientForm({ initial }: ClientFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [mapCenterLat, setMapCenterLat] = useState(initial?.map_center_lat ?? -21.9);
  const [mapCenterLng, setMapCenterLng] = useState(initial?.map_center_lng ?? -48.67);
  const [mapZoom, setMapZoom] = useState(initial?.map_zoom ?? 11);
  const [zoomToLayer, setZoomToLayer] = useState(initial?.zoom_to_layer ?? '');
  const [farmCodeFields, setFarmCodeFields] = useState(
    (initial?.farm_code_fields ?? ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel']).join(', ')
  );
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? '#9ACD32');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name,
      slug,
      mapCenterLat: Number(mapCenterLat),
      mapCenterLng: Number(mapCenterLng),
      mapZoom: Number(mapZoom),
      zoomToLayer: zoomToLayer || null,
      farmCodeFields: farmCodeFields.split(',').map((s) => s.trim()).filter(Boolean),
      primaryColor,
      isActive,
    };

    const res = initial
      ? await fetch(`/api/admin/clients/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erro ao salvar.');
      return;
    }

    const body = await res.json();
    const finalSlug = body.client?.slug || slug;
    router.push(`/admin/clientes/${finalSlug}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Nome do cliente</label>
        <input
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          Slug (URL: /cliente/&lt;slug&gt;) {initial && '- não pode ser alterado após criação'}
        </label>
        <input
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!!initial}
          placeholder="deixe vazio para gerar a partir do nome"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Latitude central</label>
          <input
            type="number"
            step="any"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={mapCenterLat}
            onChange={(e) => setMapCenterLat(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Longitude central</label>
          <input
            type="number"
            step="any"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={mapCenterLng}
            onChange={(e) => setMapCenterLng(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Zoom inicial</label>
          <input
            type="number"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={mapZoom}
            onChange={(e) => setMapZoom(Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          Layer key da área de estudo (zoom automático ao carregar)
        </label>
        <input
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          value={zoomToLayer ?? ''}
          onChange={(e) => setZoomToLayer(e.target.value)}
          placeholder="ex: Area_de_Influencias_Direta"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Campos de busca por fazenda (separados por vírgula)</label>
        <input
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          value={farmCodeFields}
          onChange={(e) => setFarmCodeFields(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Cor primária</label>
          <input
            type="color"
            className="h-9 w-16 rounded border border-white/10 bg-zinc-900"
            value={primaryColor ?? '#9ACD32'}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
        </div>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Cliente ativo (visível em /cliente/{slug})
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
      >
        {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar cliente'}
      </button>
    </form>
  );
}
