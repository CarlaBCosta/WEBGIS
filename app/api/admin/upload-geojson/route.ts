import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { preprocessGeoJSON, detectGeometryType, type GeoJSONFeatureCollection } from '@/lib/geo/preprocess';

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const file = form.get('file') as File | null;
  const slug = form.get('slug') as string | null;
  const groupId = form.get('groupId') as string | null;
  const layerKey = (form.get('layerKey') as string | null)?.replace(/[^a-zA-Z0-9_]/g, '_');
  const label = form.get('label') as string | null;
  const legendStyle = (form.get('legendStyle') as string | null) || '';
  const styleRaw = form.get('style') as string | null;
  const defaultActive = form.get('defaultActive') === 'true';
  const sourceCrs = (form.get('sourceCrs') as string | null) === 'EPSG:31982' ? 'EPSG:31982' : 'EPSG:4326';
  const toleranceMeters = Number(form.get('toleranceMeters') ?? 5);

  if (!file || !slug || !groupId || !layerKey || !label) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
  }

  let parsed: GeoJSONFeatureCollection;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: 'Arquivo não é um JSON válido.' }, { status: 400 });
  }

  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features) || parsed.features.length === 0) {
    return NextResponse.json({ error: 'GeoJSON inválido ou vazio (esperado FeatureCollection com features).' }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: `Cliente "${slug}" não encontrado.` }, { status: 404 });
  }

  const { collection, originalCount, keptCount } = preprocessGeoJSON(parsed, {
    sourceCrs,
    toleranceMeters,
  });

  const storagePath = `${slug}/${layerKey}.geojson`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('client-data')
    .upload(storagePath, JSON.stringify(collection), {
      contentType: 'application/geo+json',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Falha no upload: ${uploadError.message}` }, { status: 500 });
  }

  const { data: existing } = await supabaseAdmin
    .from('layers')
    .select('sort_order')
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  let style = {};
  try {
    style = styleRaw ? JSON.parse(styleRaw) : {};
  } catch {
    // keep default {}
  }

  const { data: layer, error: upsertError } = await supabaseAdmin
    .from('layers')
    .upsert(
      {
        client_id: client.id,
        group_id: groupId,
        layer_key: layerKey,
        label,
        legend_style: legendStyle,
        style,
        default_active: defaultActive,
        sort_order: nextOrder,
        storage_path: storagePath,
        geometry_type: detectGeometryType(collection),
        feature_count: keptCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,layer_key' }
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  return NextResponse.json({
    layer,
    originalCount,
    keptCount,
  });
}
