import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Catálogo de classes de uso do solo da visão MUT (tabela mut_classes,
// migration 0009). Aqui só o modelo global (client_id nulo): é ele que o
// portal usa para colorir os talhões e montar a legenda.

function corValida(valor: unknown): string | null {
  const cor = String(valor ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor.toUpperCase() : null;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('mut_classes')
    .select('*')
    .is('client_id', null)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ classes: [] });
  return NextResponse.json({ classes: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nome = String(body.nome ?? '').trim();
  const cor = corValida(body.cor);
  if (!nome) return NextResponse.json({ error: 'Informe o nome da classe.' }, { status: 400 });
  if (!cor) return NextResponse.json({ error: 'Escolha uma cor para a classe.' }, { status: 400 });

  const { data: ultimo } = await supabaseAdmin
    .from('mut_classes')
    .select('sort_order')
    .is('client_id', null)
    .order('sort_order', { ascending: false })
    .limit(1);

  const { data, error } = await supabaseAdmin
    .from('mut_classes')
    .insert({ client_id: null, nome, cor, sort_order: (ultimo?.[0]?.sort_order ?? 0) + 1 })
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? `Já existe uma classe chamada "${nome}".` : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ classe: data }, { status: 201 });
}

// { id, nome?, cor? } ou reordenação { ordem: [{ id, sortOrder }] }
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (Array.isArray(body.ordem)) {
    for (const item of body.ordem as { id: string; sortOrder: number }[]) {
      const { error } = await supabaseAdmin
        .from('mut_classes')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = {};
  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ error: 'O nome não pode ficar vazio.' }, { status: 400 });
    update.nome = nome;
  }
  if (body.cor !== undefined) {
    const cor = corValida(body.cor);
    if (!cor) return NextResponse.json({ error: 'Cor inválida.' }, { status: 400 });
    update.cor = cor;
  }

  const { data, error } = await supabaseAdmin
    .from('mut_classes')
    .update(update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'Já existe uma classe com esse nome.' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ classe: data });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('mut_classes').delete().eq('id', id).is('client_id', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
