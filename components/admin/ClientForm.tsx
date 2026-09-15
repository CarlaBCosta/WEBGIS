'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import type { ClientRow, LayerGroupTemplateRow } from '@/lib/types/database';
import { CAMPO_FAZENDA_PADRAO, sugerirCamadaFazendas } from '@/lib/timelapse';

// Mesma regra de slug do servidor (app/api/admin/clients/route.ts), usada
// aqui só para a prévia — o valor final é sempre o do servidor.
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function layerKeyFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

function normalizeKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Conectivos que ficam em minúscula no meio do nome (padrão tipográfico).
const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'para', 'por']);

// Usuários enviam arquivos sem padrão (MAIÚSCULAS, minúsculas, misto).
// Normaliza o nome exibido: cada palavra com inicial maiúscula e o restante
// minúsculo; conectivos em minúscula. Ex: "AREA_DE_INFLUENCIA" → "Area de
// Influencia"; "reserva_legal" → "Reserva Legal".
function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// Convenção NOMEDACAMADA_FONTE.geojson (ex: Hidrografia_ANA.geojson): o
// último segmento vira a fonte da camada; o restante vira o nome exibido.
function parseFilename(filename: string): { name: string; source: string | null } {
  const base = filename.replace(/\.[^.]+$/, '');
  const parts = base.split('_').filter(Boolean);
  if (parts.length < 2) return { name: titleCase(base.trim()), source: null };
  return { name: titleCase(parts.slice(0, -1).join(' ')), source: parts[parts.length - 1] };
}

// Classifica a camada em um dos grupos temáticos padrão pelas palavras-chave
// (vindas do banco). Palavras com "_" casam como trecho do nome completo;
// palavras simples casam segmento a segmento — e a mais longa vence (ex:
// "usinas_vizinhas" → Infraestrutura ganha de "usina" → Empreendimento).
function classifyLayer(key: string, templates: LayerGroupTemplateRow[]): string {
  const norm = normalizeKey(key);
  const segments = norm.split('_');
  let best = { title: templates[0]?.title ?? 'Camadas do Projeto', len: 0 };
  for (const t of templates) {
    for (const kw of t.keywords) {
      const hit = kw.includes('_') ? norm.includes(kw) : segments.includes(kw);
      if (hit && kw.length > best.len) best = { title: t.title, len: kw.length };
    }
  }
  return best.title;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const COLOR_PRESETS = ['#9ACD32', '#2E8B57', '#3BA7C9', '#DAA520', '#C46A4A', '#7A6FBE'];

// Cores atribuídas automaticamente às camadas do ZIP, em ciclo.
const LAYER_PALETTE = [
  '#66BB6A', '#42A5F5', '#FFA726', '#AB47BC', '#EF5350',
  '#26A69A', '#D4E157', '#8D6E63', '#5C6BC0', '#EC407A',
];

// A área de estudo ganha um traçado próprio (contorno azul tracejado, sem
// preenchimento) para não competir visualmente com as camadas temáticas.
const AID_STYLE = { color: '#3B82F6', fillOpacity: 0.05, weight: 2.5, dashArray: '6 4' };

type UploadStatus = 'pendente' | 'enviando' | 'ok' | 'erro';

interface PendingLayer {
  key: string;
  label: string;
  size: number;
  blob: Blob;
  source: string | null;
  groupTitle: string;
  isAid: boolean;
  visible: boolean;
  status: UploadStatus;
  error?: string;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm ' +
  'placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none ' +
  'focus:ring-1 focus:ring-lime-400/30 disabled:opacity-50';

interface ClientFormProps {
  initial?: ClientRow;
  // Tipos de projeto cadastrados no banco (migration 0008), na ordem de exibição.
  tiposProjeto: string[];
  // Camadas que o cliente já tem (edição): mesmo nome = substituição.
  camadasExistentes?: { layer_key: string; label: string }[];
}

export function ClientForm({ initial, tiposProjeto, camadasExistentes = [] }: ClientFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projetos, setProjetos] = useState<string[]>(initial?.projetos ?? []);
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? '#9ACD32');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logo_url ?? null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<PendingLayer[]>([]);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reproject, setReproject] = useState(false);
  // Timelapses: pedido criado para o robô logo após o envio das camadas. Na
  // edição começa desmarcado (o card de timelapses da página cuida dos pedidos).
  const [gerarTimelapses, setGerarTimelapses] = useState(!initial);
  const [camadaFazendas, setCamadaFazendas] = useState('');
  const [maxBoundsBufferKm, setMaxBoundsBufferKm] = useState(initial?.map_bounds_buffer_km ?? 30);

  // Avançado (com padrões que atendem a maioria dos casos)
  const [zoomToLayer, setZoomToLayer] = useState(initial?.zoom_to_layer ?? '');
  const [mapCenterLat, setMapCenterLat] = useState(initial?.map_center_lat ?? -21.9);
  const [mapCenterLng, setMapCenterLng] = useState(initial?.map_center_lng ?? -48.67);
  const [mapZoom, setMapZoom] = useState(initial?.map_zoom ?? 11);
  const [farmCodeFields, setFarmCodeFields] = useState(
    (initial?.farm_code_fields ?? ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel']).join(', ')
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  // Taxonomia padrão de grupos (banco, migration 0003). Vazia = fallback
  // para um grupo único "Camadas do Projeto", como antes.
  const [templates, setTemplates] = useState<LayerGroupTemplateRow[]>([]);
  useEffect(() => {
    fetch('/api/admin/group-templates')
      .then((r) => r.json())
      .then((b) => setTemplates(b.templates ?? []))
      .catch(() => {});
  }, []);

  // Envio retomável: guarda o cliente já criado para que um novo clique
  // reenvie apenas as camadas que falharam, sem recriar nada.
  const [created, setCreated] = useState<{ clientId: string; slug: string } | null>(null);
  const [sendProgress, setSendProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const isEdit = !!initial;

  async function addFiles(files: FileList | File[]) {
    setReading(true);
    setError('');
    const found: PendingLayer[] = [];

    try {
      for (const file of Array.from(files)) {
        if (/\.zip$/i.test(file.name)) {
          const zip = await JSZip.loadAsync(file);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir || !/\.(geojson|json)$/i.test(entry.name)) continue;
            const blob = await entry.async('blob');
            const base = entry.name.split('/').pop() ?? entry.name;
            const key = layerKeyFromFilename(base);
            const { name: layerName, source } = parseFilename(base);
            found.push({
              key,
              label: layerName,
              size: blob.size,
              blob,
              source,
              groupTitle: classifyLayer(key, templates),
              isAid: false,
              visible: false,
              status: 'pendente',
            });
          }
        } else if (/\.(geojson|json)$/i.test(file.name)) {
          const key = layerKeyFromFilename(file.name);
          const { name: layerName, source } = parseFilename(file.name);
          found.push({
            key,
            label: layerName,
            size: file.size,
            blob: file,
            source,
            groupTitle: classifyLayer(key, templates),
            isAid: false,
            visible: false,
            status: 'pendente',
          });
        }
      }
    } catch {
      setError('Não foi possível ler o arquivo. Confira se o ZIP não está corrompido.');
      setReading(false);
      return;
    }

    setLayers((prev) => {
      const merged = [...prev];
      for (const layer of found) {
        if (!merged.some((l) => l.key === layer.key)) merged.push(layer);
      }
      // Pré-seleciona a área de estudo pelo nome, se ainda não houver uma.
      if (!merged.some((l) => l.isAid)) {
        const aid = merged.find((l) => /influ|aid/i.test(l.key));
        if (aid) {
          aid.isAid = true;
          aid.visible = true;
        }
      }
      return merged;
    });
    setReading(false);
  }

  function setAid(key: string) {
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        isAid: l.key === key,
        visible: l.key === key ? true : l.visible,
      }))
    );
  }

  function toggleVisible(key: string) {
    setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, visible: !l.visible } : l)));
  }

  function setGroup(key: string, groupTitle: string) {
    setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, groupTitle } : l)));
  }

  function removeLayer(key: string) {
    setLayers((prev) => prev.filter((l) => l.key !== key));
  }

  function markLayer(key: string, patch: Partial<PendingLayer>) {
    setLayers((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const aidKey = layers.find((l) => l.isAid)?.key ?? zoomToLayer ?? '';

    const payload = {
      name,
      slug: effectiveSlug,
      mapCenterLat: Number(mapCenterLat),
      mapCenterLng: Number(mapCenterLng),
      mapZoom: Number(mapZoom),
      zoomToLayer: aidKey || null,
      maxBoundsBufferKm: Number(maxBoundsBufferKm) > 0 ? Number(maxBoundsBufferKm) : 30,
      farmCodeFields: farmCodeFields.split(',').map((s) => s.trim()).filter(Boolean),
      primaryColor,
      isActive,
      projetos,
    };

    let clientId = created?.clientId ?? initial?.id ?? null;
    let finalSlug = created?.slug ?? initial?.slug ?? effectiveSlug;

    if (isEdit) {
      const res = await fetch(`/api/admin/clients/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Erro ao salvar o cliente.');
        setSaving(false);
        return;
      }
    } else if (!clientId) {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        clientId = body.client.id;
        finalSlug = body.client.slug;
      } else if (typeof body.error === 'string' && body.error.includes('clients_slug_key')) {
        // Cliente já existe (envio anterior interrompido): reaproveita e
        // segue para o reenvio das camadas pendentes.
        const listRes = await fetch('/api/admin/clients');
        const listBody = await listRes.json().catch(() => ({}));
        const found = (listBody.clients as ClientRow[] | undefined)?.find(
          (c) => c.slug === effectiveSlug
        );
        if (!found) {
          setError(`O endereço /cliente/${effectiveSlug} já está em uso por outro cliente. Escolha outro.`);
          setSaving(false);
          return;
        }
        clientId = found.id;
        finalSlug = found.slug;
      } else {
        setError(body.error || 'Erro ao criar o cliente.');
        setSaving(false);
        return;
      }
      setCreated({ clientId: clientId!, slug: finalSlug });
    }

    // Logo: enviada após o cliente existir; num reenvio não é repetida.
    if (logoFile && clientId) {
      const lf = new FormData();
      lf.set('file', logoFile);
      lf.set('slug', finalSlug);
      lf.set('clientId', clientId);
      const lRes = await fetch('/api/admin/upload-logo', { method: 'POST', body: lf });
      if (!lRes.ok) {
        const lBody = await lRes.json().catch(() => ({}));
        setError(lBody.error || 'Falha ao enviar a logo. Tente salvar de novo.');
        setSaving(false);
        return;
      }
      setLogoFile(null);
    }

    // Todo cliente novo recebe as divisões do modelo (mesmo sem camadas ainda);
    // divisões já existentes de um envio anterior não são duplicadas.
    if (!isEdit && clientId) {
      const mRes = await fetch('/api/admin/layer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, carregarModelo: true }),
      });
      if (!mRes.ok) {
        const mBody = await mRes.json().catch(() => ({}));
        setError(mBody.error || 'Cliente criado, mas falhou ao carregar o modelo de divisões.');
        setSaving(false);
        return;
      }
    }

    // Envia as camadas: no cadastro e também na edição (novas camadas ou versões
    // atualizadas — mesmo nome de arquivo substitui a camada existente).
    const pendingLayers = layers.filter((l) => l.status !== 'ok');
    if (pendingLayers.length > 0 && clientId) {
      // Cria as divisões que o cliente ainda não tem (ex.: excluída antes).
      const templateOrder = new Map(templates.map((t, i) => [t.title, i]));
      const neededTitles = [...new Set(pendingLayers.map((l) => l.groupTitle))].sort(
        (a, b) => (templateOrder.get(a) ?? 99) - (templateOrder.get(b) ?? 99)
      );

      const gList = await fetch(`/api/admin/layer-groups?clientId=${clientId}`);
      const gListBody = await gList.json().catch(() => ({}));
      const groupIds: Record<string, string> = {};
      for (const g of (gListBody.groups as { id: string; title: string }[] | undefined) ?? []) {
        groupIds[g.title] = g.id;
      }

      for (const title of neededTitles) {
        if (groupIds[title]) continue;
        const doModelo = templates.find((t) => t.title === title);
        const gRes = await fetch('/api/admin/layer-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doModelo ? { clientId, templateId: doModelo.id } : { clientId, title }),
        });
        const gBody = await gRes.json().catch(() => ({}));
        const novo = gBody.group ?? gBody.groups?.[0];
        if (!gRes.ok || !novo) {
          setError(gBody.error || `Falhou ao criar a divisão "${title}".`);
          setSaving(false);
          return;
        }
        groupIds[title] = novo.id;
      }

      let done = 0;
      let failed = 0;
      setSendProgress({ done: 0, total: pendingLayers.length, current: pendingLayers[0].label });

      for (const layer of pendingLayers) {
        markLayer(layer.key, { status: 'enviando', error: undefined });
        setSendProgress({ done, total: pendingLayers.length, current: layer.label });

        const paletteColor = LAYER_PALETTE[layers.findIndex((l) => l.key === layer.key) % LAYER_PALETTE.length];
        const style = layer.isAid
          ? AID_STYLE
          : { color: paletteColor, fillColor: paletteColor, fillOpacity: 0.25, weight: 2, radius: 6 };

        const form = new FormData();
        form.set('file', layer.blob, `${layer.key}.geojson`);
        form.set('slug', finalSlug);
        form.set('groupId', groupIds[layer.groupTitle]);
        form.set('layerKey', layer.key);
        form.set('label', layer.label);
        form.set('style', JSON.stringify(style));
        form.set('defaultActive', String(layer.visible));
        form.set('sourceCrs', reproject ? 'EPSG:31982' : 'EPSG:4326');
        if (layer.source) form.set('source', layer.source);

        try {
          const upRes = await fetch('/api/admin/upload-geojson', { method: 'POST', body: form });
          if (!upRes.ok) {
            const upBody = await upRes.json().catch(() => ({}));
            throw new Error(upBody.error || `HTTP ${upRes.status}`);
          }
          markLayer(layer.key, { status: 'ok' });
        } catch (err) {
          failed++;
          markLayer(layer.key, {
            status: 'erro',
            error: err instanceof Error ? err.message : 'Falha no envio',
          });
        }
        done++;
        setSendProgress({ done, total: pendingLayers.length, current: layer.label });
      }

      setSendProgress(null);

      if (failed > 0) {
        setError(
          `${failed} camada(s) falharam — as demais foram enviadas. Clique em "Reenviar" para tentar de novo só as que falharam (arquivos muito grandes podem precisar ser removidos).`
        );
        setSaving(false);
        return;
      }
    }

    // Pede os timelapses ao robô depois que todas as camadas subiram. Uma falha
    // aqui não impede o cadastro: o pedido pode ser refeito na página do cliente.
    const camadaEscolhida = camadaFazendasEfetiva();
    if (gerarTimelapses && pendingLayers.length > 0 && camadaEscolhida && clientId) {
      const tRes = await fetch('/api/admin/timelapse-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          layerKey: camadaEscolhida,
          campo: farmCodeFields.split(',').map((s) => s.trim()).filter(Boolean)[0] || CAMPO_FAZENDA_PADRAO,
          sensor: 'landsat',
        }),
      });
      if (!tRes.ok && tRes.status !== 409) {
        console.warn('Pedido de timelapses não criado:', await tRes.text().catch(() => ''));
      }
    }

    setSaving(false);
    router.push(`/admin/clientes/${finalSlug}`);
    router.refresh();
  }

  // A escolha manual vale enquanto a camada continuar na lista; senão, sugestão pelo nome.
  function camadaFazendasEfetiva(): string {
    if (camadaFazendas && layers.some((l) => l.key === camadaFazendas)) return camadaFazendas;
    return sugerirCamadaFazendas(layers.map((l) => l.key)) ?? '';
  }

  const aidSelected = layers.find((l) => l.isAid);
  const failedCount = layers.filter((l) => l.status === 'erro').length;
  const sentCount = layers.filter((l) => l.status === 'ok').length;
  const pendingCount = layers.length - sentCount;

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-10">
      {/* Passo 1 — Nome */}
      <section className="flex gap-5">
        <StepMarker n={1} />
        <div className="min-w-0 flex-1 space-y-3 pb-2">
          <h2 className="text-base font-medium text-zinc-100">Como o cliente se chama?</h2>
          <input
            className={`${inputClass} text-base`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Usina Santa Adélia"
            autoFocus={!isEdit}
            required
            disabled={!!created}
            aria-label="Nome do cliente"
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-zinc-500">Portal em</span>
            <code className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-[13px] text-lime-300/90">
              /cliente/
              <input
                className="w-44 bg-transparent font-mono text-lime-300/90 placeholder:text-zinc-600 focus:outline-none disabled:opacity-60"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                disabled={isEdit || !!created}
                placeholder="gerado-do-nome"
                aria-label="Endereço do portal (slug)"
              />
            </code>
            {(isEdit || created) && <span className="text-xs text-zinc-600">fixo após a criação</span>}
          </div>
        </div>
      </section>

      {/* Passo 2 — Projeto */}
      <section className="flex gap-5">
        <StepMarker n={2} />
        <div className="min-w-0 flex-1 space-y-3 pb-2">
          <div>
            <h2 className="text-base font-medium text-zinc-100">Projeto</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Marque um ou mais — um cliente pode ter, por exemplo, Bonsucro e ISCC EU.
            </p>
          </div>
          {tiposProjeto.length === 0 ? (
            <p className="text-xs text-amber-400/90">
              Nenhum tipo de projeto cadastrado. Rode a migration 0008 no Supabase.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de projeto">
              {tiposProjeto.map((tipo) => {
                const marcado = projetos.includes(tipo);
                return (
                  <button
                    key={tipo}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() =>
                      setProjetos((atual) =>
                        marcado ? atual.filter((p) => p !== tipo) : [...atual, tipo]
                      )
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-lime-400/40 ${
                      marcado
                        ? 'border-lime-400/60 bg-lime-400/15 text-lime-200'
                        : 'border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                    }`}
                  >
                    {marcado ? '✓ ' : ''}
                    {tipo}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Passo 3 — Logo */}
      <section className="flex gap-5">
        <StepMarker n={3} />
        <div className="min-w-0 flex-1 space-y-3 pb-2">
          <h2 className="text-base font-medium text-zinc-100">Logo do cliente</h2>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-lg bg-[#f5f6f7] p-2">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Prévia da logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-zinc-400">sem logo</span>
              )}
            </span>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-200 hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-lime-400/40"
              >
                {logoPreview ? 'Trocar logo' : 'Escolher imagem'}
              </button>
              {logoFile && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview(initial?.logo_url ?? null);
                  }}
                  className="block text-xs text-zinc-500 hover:text-red-400"
                >
                  descartar seleção
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setLogoFile(f);
                  setLogoPreview(URL.createObjectURL(f));
                }
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Aparece no canto direito do cabeçalho do portal, sobre fundo claro. PNG, JPG, SVG ou
            WebP, até 2 MB.
          </p>
        </div>
      </section>

      {/* Passo 4 — Camadas (cadastro e edição) */}
        <section className="flex gap-5">
          <StepMarker n={4} />
          <div className="min-w-0 flex-1 space-y-4 pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-medium text-zinc-100">Camadas do projeto</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {isEdit
                    ? 'Envie camadas novas ou versões atualizadas. Arquivo com o mesmo nome substitui a camada existente.'
                    : 'Envie um ZIP com os GeoJSON exportados do QGIS — ou os arquivos soltos.'}
                </p>
              </div>
              {isEdit && initial && (
                <Link
                  href={`/admin/clientes/${initial.slug}/camadas`}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/25 hover:bg-white/5"
                >
                  Organizar as {camadasExistentes.length} camadas atuais →
                </Link>
              )}
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-lime-400/40 ${
                dragOver
                  ? 'border-lime-400/70 bg-lime-400/5'
                  : 'border-white/15 bg-zinc-900/40 hover:border-white/30'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                🗂️
              </span>
              <span className="text-sm text-zinc-300">
                {reading ? 'Lendo arquivos...' : 'Arraste o .zip das camadas aqui'}
              </span>
              <span className="text-xs text-zinc-500">ou clique para escolher (.zip, .geojson)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.geojson,.json"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {layers.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/30">
                {/* Resumo e explicação das colunas de escolha */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-200">
                    {layers.length} camada{layers.length > 1 ? 's' : ''} para enviar
                    {(sentCount > 0 || failedCount > 0) && (
                      <span className="ml-2 text-xs font-normal">
                        <span className="text-emerald-400">{sentCount} enviada{sentCount === 1 ? '' : 's'}</span>
                        {failedCount > 0 && <span className="text-red-400"> · {failedCount} com falha</span>}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    <b className="font-medium text-zinc-400">Área de estudo:</b> a camada que enquadra e limita o mapa
                    (só uma). <b className="font-medium text-zinc-400">Ligada ao abrir:</b> já aparece acesa no portal.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-52" />
                      <col className="w-28" />
                      <col className="w-24" />
                      <col className="w-24" />
                      <col className="w-12" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-white/10 bg-zinc-900/60 text-xs font-medium text-zinc-500">
                        <th scope="col" className="px-4 py-2 text-left font-medium">Camada</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">Divisão</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">Envio</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium">Área de estudo</th>
                        <th scope="col" className="px-2 py-2 text-center font-medium">Ligada ao abrir</th>
                        <th scope="col" className="px-2 py-2">
                          <span className="sr-only">Remover</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {layers.map((l) => {
                        const substitui = camadasExistentes.some((c) => c.layer_key === l.key);
                        return (
                          <tr key={l.key} className="align-middle">
                            <td className="px-4 py-2.5">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-zinc-200" title={l.label}>
                                  {l.label}
                                </span>
                                {l.source && (
                                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                    {l.source}
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-zinc-600" title={l.error}>
                                {formatSize(l.size)}
                                {substitui && <span className="text-amber-400/90"> · substitui a camada atual</span>}
                                {l.status === 'erro' && l.error && <span className="text-red-400/80"> · {l.error}</span>}
                              </div>
                            </td>
                            <td className="px-2 py-2.5">
                              <select
                                value={l.groupTitle}
                                onChange={(e) => setGroup(l.key, e.target.value)}
                                disabled={saving || l.status === 'ok'}
                                title={l.groupTitle}
                                className="w-full truncate rounded-md border border-white/10 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-300 focus:border-lime-400/60 focus:outline-none disabled:opacity-50"
                                aria-label={`Divisão da camada ${l.label}`}
                              >
                                {(templates.length > 0 ? templates.map((t) => t.title) : ['Camadas do Projeto']).map(
                                  (t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>
                            <td className="px-2 py-2.5">
                              <StatusBadge status={l.status} />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="radio"
                                name="aid-layer"
                                checked={l.isAid}
                                onChange={() => setAid(l.key)}
                                disabled={saving || l.status === 'ok'}
                                aria-label={`Usar ${l.label} como área de estudo`}
                                className="h-4 w-4 accent-lime-500"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={l.visible}
                                onChange={() => toggleVisible(l.key)}
                                disabled={saving || l.status === 'ok'}
                                aria-label={`Deixar ${l.label} ligada ao abrir o portal`}
                                className="h-4 w-4 accent-lime-500"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeLayer(l.key)}
                                disabled={saving || l.status === 'ok'}
                                className="rounded-md px-1.5 text-lg leading-none text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:invisible"
                                aria-label={`Tirar ${l.label} da lista`}
                                title="Tirar da lista"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sendProgress && (
              <div className="space-y-1.5" role="status" aria-live="polite">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="truncate text-zinc-300">Enviando {sendProgress.current}...</span>
                  <span className="ml-3 shrink-0 tabular-nums text-zinc-500">
                    {sendProgress.done} de {sendProgress.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-lime-400 transition-all duration-300"
                    style={{
                      width: `${sendProgress.total ? Math.round((sendProgress.done / sendProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {layers.length > 0 && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                  <span>O mapa abre enquadrado na área de estudo e navega até</span>
                  <span className="relative inline-flex">
                    <input
                      type="number"
                      step="any"
                      min={1}
                      className="w-20 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 pr-9 text-sm focus:border-lime-400/60 focus:outline-none"
                      value={maxBoundsBufferKm}
                      onChange={(e) => setMaxBoundsBufferKm(Number(e.target.value))}
                      aria-label="Limite de navegação em km"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-zinc-500">
                      km
                    </span>
                  </span>
                  <span>ao redor dela.</span>
                </div>
                {!aidSelected && (
                  <p className="text-xs text-amber-400/90">
                    Nenhuma camada marcada como área de estudo — sem ela o mapa abre no centro
                    padrão, sem limite de navegação.
                  </p>
                )}
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={reproject}
                    onChange={(e) => setReproject(e.target.checked)}
                    disabled={saving || sentCount > 0}
                  />
                  Os arquivos estão em SIRGAS 2000 / UTM 22S (reprojetar para WGS84)
                </label>
                <div className="border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={gerarTimelapses}
                      onChange={(e) => setGerarTimelapses(e.target.checked)}
                      disabled={saving}
                    />
                    Gerar timelapses das fazendas (vídeo de satélite 2007 → hoje)
                  </label>
                  {gerarTimelapses && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-xs text-zinc-400">
                      <span>Camada das fazendas:</span>
                      <select
                        value={camadaFazendasEfetiva()}
                        onChange={(e) => setCamadaFazendas(e.target.value)}
                        disabled={saving}
                        className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 focus:border-lime-400/60 focus:outline-none"
                        aria-label="Camada com os polígonos das fazendas"
                      >
                        {!camadaFazendasEfetiva() && <option value="">escolha a camada</option>}
                        {layers.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-zinc-600">
                        o robô gera os vídeos em segundo plano; acompanhe na página do cliente
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

      {/* Avançado */}
      <details className="ml-12 rounded-xl border border-white/10">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200">
          Configurações avançadas
          <span className="mt-0.5 block text-xs text-zinc-600">
            Cor primária, centro do mapa, zoom, busca por fazenda
            {isEdit ? ', área de estudo' : ''} — os padrões atendem a maioria dos casos.
          </span>
        </summary>
        <div className="space-y-4 border-t border-white/10 p-4">
          <div>
            <span className="mb-1.5 block text-sm text-zinc-400">
              Cor primária (destaques do portal)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Usar cor ${c}`}
                  onClick={() => setPrimaryColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform focus:outline-none focus:ring-2 focus:ring-lime-400/50 ${
                    primaryColor.toLowerCase() === c.toLowerCase()
                      ? 'scale-110 border-white'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-white/25">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: primaryColor }}
                />
                outra
                <input
                  type="color"
                  className="h-0 w-0 opacity-0"
                  value={primaryColor ?? '#9ACD32'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  aria-label="Escolher outra cor"
                />
              </label>
            </div>
          </div>
          {isEdit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="client-aid" className="mb-1 block text-sm text-zinc-400">
                  Camada da área de estudo (layer key)
                </label>
                <input
                  id="client-aid"
                  className={`${inputClass} font-mono`}
                  value={zoomToLayer ?? ''}
                  onChange={(e) => setZoomToLayer(e.target.value)}
                  placeholder="ex: Area_de_Influencias_Direta"
                />
              </div>
              <div>
                <label htmlFor="client-buffer" className="mb-1 block text-sm text-zinc-400">
                  Limite de navegação (km)
                </label>
                <input
                  id="client-buffer"
                  type="number"
                  step="any"
                  min={1}
                  className={inputClass}
                  value={maxBoundsBufferKm}
                  onChange={(e) => setMaxBoundsBufferKm(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="client-lat" className="mb-1 block text-sm text-zinc-400">
                Latitude central
              </label>
              <input
                id="client-lat"
                type="number"
                step="any"
                className={inputClass}
                value={mapCenterLat}
                onChange={(e) => setMapCenterLat(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="client-lng" className="mb-1 block text-sm text-zinc-400">
                Longitude central
              </label>
              <input
                id="client-lng"
                type="number"
                step="any"
                className={inputClass}
                value={mapCenterLng}
                onChange={(e) => setMapCenterLng(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="client-zoom" className="mb-1 block text-sm text-zinc-400">
                Zoom inicial
              </label>
              <input
                id="client-zoom"
                type="number"
                className={inputClass}
                value={mapZoom}
                onChange={(e) => setMapZoom(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Usados apenas enquanto não houver área de estudo — com ela, o enquadramento é
            automático.
          </p>
          <div>
            <label htmlFor="client-farm-fields" className="mb-1 block text-sm text-zinc-400">
              Campos de busca por fazenda (separados por vírgula)
            </label>
            <input
              id="client-farm-fields"
              className={`${inputClass} font-mono`}
              value={farmCodeFields}
              onChange={(e) => setFarmCodeFields(e.target.value)}
            />
          </div>
        </div>
      </details>

      {/* Ações */}
      <div className="ml-12 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-lime-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:opacity-50"
        >
          {saving
            ? 'Enviando...'
            : isEdit
              ? pendingCount > 0
                ? `Salvar e enviar ${pendingCount} camada${pendingCount > 1 ? 's' : ''}`
                : 'Salvar alterações'
              : created && failedCount > 0
                ? `Reenviar ${failedCount} camada${failedCount > 1 ? 's' : ''} com falha`
                : layers.length > 0
                  ? `Criar cliente e enviar ${pendingCount} camada${pendingCount > 1 ? 's' : ''}`
                  : 'Criar cliente'}
        </button>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Portal ativo
          </label>
        )}
        {error && <p className="basis-full text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: UploadStatus }) {
  if (status === 'ok') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        ✓ enviada
      </span>
    );
  }
  if (status === 'enviando') {
    return (
      <span className="animate-pulse rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
        enviando...
      </span>
    );
  }
  if (status === 'erro') {
    return (
      <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
        falhou
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
      aguardando
    </span>
  );
}

function StepMarker({ n }: { n: number }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10 text-sm font-semibold text-lime-300">
        {n}
      </span>
      <span className="mt-2 w-px flex-1 bg-white/10" />
    </div>
  );
}
