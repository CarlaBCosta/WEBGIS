import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Modelo global de divisões (tabela layer_group_templates). Todo cliente novo
// recebe essas divisões; o cadastro também usa as palavras-chave para
// classificar as camadas enviadas. Se a migration 0003 não tiver sido aplicada,
// o GET devolve lista vazia e o cadastro usa um grupo único como antes.

function normalizarPalavras(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : String(valor ?? '').split(',');
  return [
    ...new Set(
      lista
        .map((p) =>
          String(p)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
        )
        .filter(Boolean)
    ),
  ];
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('layer_group_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ templates: [] });
  return NextResponse.json({ templates: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'Informe o nome da divisão.' }, { status: 400 });

  const { data: ultimo } = await supabaseAdmin
    .from('layer_group_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const { data, error } = await supabaseAdmin
    .from('layer_group_templates')
    .insert({
      title,
      descricao: String(body.descricao ?? '').trim(),
      keywords: normalizarPalavras(body.keywords),
      sort_order: (ultimo?.[0]?.sort_order ?? 0) + 1,
    })
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? `Já existe uma divisão chamada "${title}".` : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ template: data }, { status: 201 });
}

// { id, title?, descricao?, keywords? } ou reordenação { ordem: [{ id, sortOrder }] }
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (Array.isArray(body.ordem)) {
    for (const item of body.ordem as { id: string; sortOrder: number }[]) {
      const { error } = await supabaseAdmin
        .from('layer_group_templates')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: 'O nome não pode ficar vazio.' }, { status: 400 });
    update.title = title;
  }
  if (body.descricao !== undefined) update.descricao = String(body.descricao).trim();
  if (body.keywords !== undefined) update.keywords = normalizarPalavras(body.keywords);

  const { data, error } = await supabaseAdmin
    .from('layer_group_templates')
    .update(update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'Já existe uma divisão com esse nome.' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ template: data });
}

// Excluir do modelo não mexe nos clientes que já têm a divisão.
export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('layer_group_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
