import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, layer_groups(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const slug = body.slug ? slugify(body.slug) : slugify(body.name);

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      slug,
      name: body.name,
      map_center_lat: body.mapCenterLat ?? -21.9,
      map_center_lng: body.mapCenterLng ?? -48.67,
      map_zoom: body.mapZoom ?? 11,
      zoom_to_layer: body.zoomToLayer || null,
      farm_code_fields: body.farmCodeFields ?? ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel'],
      primary_color: body.primaryColor || '#9ACD32',
      logo_url: body.logoUrl || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ client: data }, { status: 201 });
}
