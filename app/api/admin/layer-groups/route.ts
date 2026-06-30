import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data: existing } = await supabaseAdmin
    .from('layer_groups')
    .select('sort_order')
    .eq('client_id', body.clientId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from('layer_groups')
    .insert({ client_id: body.clientId, title: body.title, sort_order: nextOrder })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ group: data }, { status: 201 });
}

// Bulk reorder: body = { groups: [{ id, sortOrder }] }
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const updates = (body.groups as { id: string; sortOrder: number }[]) || [];

  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from('layer_groups')
      .update({ sort_order: u.sortOrder })
      .eq('id', u.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('layer_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
