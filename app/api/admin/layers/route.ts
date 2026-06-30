import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  // Bulk reorder: { layers: [{ id, sortOrder }] }
  if (body.layers) {
    for (const u of body.layers as { id: string; sortOrder: number }[]) {
      const { error } = await supabaseAdmin
        .from('layers')
        .update({ sort_order: u.sortOrder, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // Single update: { id, label?, style?, defaultActive?, available? }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.label !== undefined) update.label = body.label;
  if (body.legendStyle !== undefined) update.legend_style = body.legendStyle;
  if (body.style !== undefined) update.style = body.style;
  if (body.defaultActive !== undefined) update.default_active = body.defaultActive;

  const { data, error } = await supabaseAdmin.from('layers').update(update).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ layer: data });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('layers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
