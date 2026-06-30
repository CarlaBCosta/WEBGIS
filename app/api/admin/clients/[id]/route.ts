import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.mapCenterLat !== undefined) update.map_center_lat = body.mapCenterLat;
  if (body.mapCenterLng !== undefined) update.map_center_lng = body.mapCenterLng;
  if (body.mapZoom !== undefined) update.map_zoom = body.mapZoom;
  if (body.zoomToLayer !== undefined) update.zoom_to_layer = body.zoomToLayer;
  if (body.farmCodeFields !== undefined) update.farm_code_fields = body.farmCodeFields;
  if (body.primaryColor !== undefined) update.primary_color = body.primaryColor;
  if (body.logoUrl !== undefined) update.logo_url = body.logoUrl;
  if (body.isActive !== undefined) update.is_active = body.isActive;

  const { data, error } = await supabaseAdmin.from('clients').update(update).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ client: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
