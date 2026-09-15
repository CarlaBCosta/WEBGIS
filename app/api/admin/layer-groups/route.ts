import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { LayerGroupRow, LayerGroupTemplateRow } from '@/lib/types/database';

// Lista os grupos de um cliente (usado pelo cadastro para retomar um envio
// interrompido sem duplicar grupos).
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('layer_groups')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data });
}

async function proximaOrdem(clientId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('layer_groups')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].sort_order + 1 : 0;
}

// Três formas:
//  { clientId, carregarModelo: true }  → inclui todas as divisões do modelo que
//                                        o cliente ainda não tem (cadastro novo)
//  { clientId, templateId }            → inclui uma divisão do modelo
//  { clientId, title, descricao? }     → cria uma divisão própria do cliente
export async function POST(request: NextRequest) {
  const body = await request.json();
  const clientId = body.clientId as string;
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  if (body.carregarModelo || body.templateId) {
    let consulta = supabaseAdmin.from('layer_group_templates').select('*').order('sort_order', { ascending: true });
    if (body.templateId) consulta = consulta.eq('id', body.templateId);
    const { data: modelo, error: erroModelo } = await consulta.returns<LayerGroupTemplateRow[]>();
    if (erroModelo) return NextResponse.json({ error: erroModelo.message }, { status: 500 });

    const { data: atuais } = await supabaseAdmin
      .from('layer_groups')
      .select('title, template_id')
      .eq('client_id', clientId)
      .returns<Pick<LayerGroupRow, 'title' | 'template_id'>[]>();
    const titulos = new Set((atuais ?? []).map((g) => g.title));
    const vindosDoModelo = new Set((atuais ?? []).map((g) => g.template_id).filter(Boolean));

    const faltando = (modelo ?? []).filter((t) => !vindosDoModelo.has(t.id) && !titulos.has(t.title));
    if (faltando.length === 0) return NextResponse.json({ groups: [] }, { status: 200 });

    const ordem = await proximaOrdem(clientId);
    const { data, error } = await supabaseAdmin
      .from('layer_groups')
      .insert(
        faltando.map((t, i) => ({
          client_id: clientId,
          title: t.title,
          descricao: t.descricao ?? '',
          template_id: t.id,
          sort_order: ordem + i,
        }))
      )
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ groups: data, group: data?.[0] }, { status: 201 });
  }

  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'Informe o nome da divisão.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('layer_groups')
    .insert({
      client_id: clientId,
      title,
      descricao: String(body.descricao ?? '').trim(),
      sort_order: await proximaOrdem(clientId),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ group: data }, { status: 201 });
}

// Reordenar { groups: [{ id, sortOrder }] } ou editar { id, title?, descricao? }
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (Array.isArray(body.groups)) {
    for (const u of body.groups as { id: string; sortOrder: number }[]) {
      const { error } = await supabaseAdmin.from('layer_groups').update({ sort_order: u.sortOrder }).eq('id', u.id);
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

  const { data, error } = await supabaseAdmin.from('layer_groups').update(update).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ group: data });
}

// { id, moverPara? }: com moverPara, as camadas vão para outra divisão antes da
// exclusão; sem ele, a divisão só é excluída se estiver vazia (evita apagar
// camadas por engano — a exclusão em cascata removeria os cadastros).
export async function DELETE(request: NextRequest) {
  const { id, moverPara } = await request.json();

  const { data: camadas } = await supabaseAdmin.from('layers').select('id').eq('group_id', id);
  const total = camadas?.length ?? 0;

  if (total > 0) {
    if (!moverPara) {
      return NextResponse.json(
        { error: `A divisão tem ${total} camada(s). Escolha para onde movê-las antes de excluir.` },
        { status: 409 }
      );
    }
    const { data: destino } = await supabaseAdmin
      .from('layers')
      .select('sort_order')
      .eq('group_id', moverPara)
      .order('sort_order', { ascending: false })
      .limit(1);
    const base = destino && destino.length > 0 ? destino[0].sort_order + 1 : 0;
    const { data: ordenadas } = await supabaseAdmin
      .from('layers')
      .select('id, sort_order')
      .eq('group_id', id)
      .order('sort_order', { ascending: true });
    for (const [i, camada] of (ordenadas ?? []).entries()) {
      const { error } = await supabaseAdmin
        .from('layers')
        .update({ group_id: moverPara, sort_order: base + i, updated_at: new Date().toISOString() })
        .eq('id', camada.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.from('layer_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, movidas: total });
}
