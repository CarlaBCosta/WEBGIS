import { supabaseBrowser } from '@/lib/supabase/client';
import type { ClientRow, LayerGroupWithLayersRow, MutClasseRow, MutConfigRow } from '@/lib/types/database';
import type { ClientConfig, MutConfig } from '@/lib/types/domain';
import { CAMPO_ELEGIBILIDADE_PADRAO, VALORES_ELEGIVEL_PADRAO } from '@/lib/mut';

// Ports loadClientConfig() from shared/app.js. Runs server-side now (called
// from app/cliente/[slug]/page.tsx, a server component) using the same
// publishable key + RLS-protected reads as the old client-side fetch.
export async function loadClientConfig(slug: string): Promise<ClientConfig | null> {
  const { data: client, error: clientError } = await supabaseBrowser
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle<ClientRow>();

  if (clientError || !client) return null;

  const { data: groups, error: groupsError } = await supabaseBrowser
    .from('layer_groups')
    .select('*, layers(*)')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: true })
    .returns<LayerGroupWithLayersRow[]>();

  if (groupsError || !groups) return null;

  groups.forEach((g) => g.layers.sort((a, b) => a.sort_order - b.sort_order));

  const mut = await carregarMut(client.id);

  return {
    slug,
    clientId: client.id,
    clientName: client.name,
    mapCenter: [client.map_center_lat, client.map_center_lng],
    mapZoom: client.map_zoom,
    zoomToLayerOnLoad: client.zoom_to_layer,
    maxBoundsBufferKm: client.map_bounds_buffer_km ?? 30,
    farmCodeFields: client.farm_code_fields,
    primaryColor: client.primary_color,
    logoUrl: client.logo_url,
    // Divisões vazias (ex.: do modelo, ainda sem camadas) não aparecem no portal.
    layerGroups: groups.filter((g) => g.layers.length > 0).map((g) => ({
      title: g.title,
      layers: g.layers.map((l) => ({
        id: l.layer_key,
        label: l.label,
        legendStyle: l.legend_style,
        style: l.style,
        defaultActive: l.default_active,
      })),
    })),
    mut,
  };
}

// Visão MUT do cliente + catálogo de classes (modelo global sobrescrito pelas
// exceções do cliente). Tabelas da migration 0009: se ela ainda não tiver sido
// aplicada, a consulta falha e o portal segue sem a visão MUT.
async function carregarMut(clientId: string): Promise<MutConfig | null> {
  const { data: cfg } = await supabaseBrowser
    .from('mut_config')
    .select('*')
    .eq('client_id', clientId)
    .eq('ativo', true)
    .maybeSingle<MutConfigRow>();

  if (!cfg?.layer_key) return null;

  const { data: linhas } = await supabaseBrowser
    .from('mut_classes')
    .select('*')
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .order('sort_order', { ascending: true })
    .returns<MutClasseRow[]>();

  const porNome = new Map<string, MutClasseRow>();
  for (const linha of linhas ?? []) {
    const chave = linha.nome.toLowerCase();
    // A exceção do cliente vence o modelo global, venha em que ordem vier.
    if (!porNome.has(chave) || linha.client_id) porNome.set(chave, linha);
  }

  return {
    layerKey: cfg.layer_key,
    campoCodigo: cfg.campo_codigo,
    campoTalhao: cfg.campo_talhao,
    campoArea: cfg.campo_area,
    campoElegibilidade: cfg.campo_elegibilidade || CAMPO_ELEGIBILIDADE_PADRAO,
    valoresElegivel: cfg.valores_elegivel?.length ? cfg.valores_elegivel : VALORES_ELEGIVEL_PADRAO,
    campoUso: cfg.campo_uso,
    nomeFazenda: cfg.nome_fazenda,
    safra: cfg.safra,
    anoInicial: cfg.ano_inicial,
    anoMut: cfg.ano_mut ?? 2008,
    classes: [...porNome.values()]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ nome: c.nome, cor: c.cor })),
  };
}
