import { supabaseBrowser } from '@/lib/supabase/client';
import type { ClientRow, LayerGroupWithLayersRow } from '@/lib/types/database';
import type { ClientConfig } from '@/lib/types/domain';

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

  return {
    slug,
    clientId: client.id,
    clientName: client.name,
    mapCenter: [client.map_center_lat, client.map_center_lng],
    mapZoom: client.map_zoom,
    zoomToLayerOnLoad: client.zoom_to_layer,
    farmCodeFields: client.farm_code_fields,
    primaryColor: client.primary_color,
    logoUrl: client.logo_url,
    layerGroups: groups.map((g) => ({
      title: g.title,
      layers: g.layers.map((l) => ({
        id: l.layer_key,
        label: l.label,
        legendStyle: l.legend_style,
        style: l.style,
        defaultActive: l.default_active,
      })),
    })),
  };
}
