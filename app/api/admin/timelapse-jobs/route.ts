import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Fila de timelapses: o painel cria pedidos; o robô (scripts/timelapse/
// robo_timelapse.py) processa. Rota protegida pelo proxy.ts como as demais.

// Último pedido do cliente + último sinal de vida do robô.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const [{ data: jobs, error }, { data: robo }] = await Promise.all([
    supabaseAdmin
      .from('timelapse_jobs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin.from('timelapse_robo').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: jobs?.[0] ?? null, robo: robo ?? null });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clientId, layerKey, campo, sensor } = body;

  if (!clientId || !layerKey) {
    return NextResponse.json({ error: 'Informe o cliente e a camada das fazendas.' }, { status: 400 });
  }

  const { data: ativos } = await supabaseAdmin
    .from('timelapse_jobs')
    .select('id')
    .eq('client_id', clientId)
    .in('status', ['pendente', 'processando'])
    .limit(1);

  if (ativos && ativos.length > 0) {
    return NextResponse.json(
      { error: 'Já existe um pedido de timelapses em andamento para este cliente.' },
      { status: 409 }
    );
  }

  const rawUser = request.cookies.get('admin_user')?.value;

  const { data, error } = await supabaseAdmin
    .from('timelapse_jobs')
    .insert({
      client_id: clientId,
      layer_key: layerKey,
      campo: campo || 'FAZENDA',
      sensor: sensor === 'sentinel2' ? 'sentinel2' : 'landsat',
      criado_por: rawUser ? decodeURIComponent(rawUser) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ job: data }, { status: 201 });
}

// Cancelar: o robô confere o status antes de cada fazenda e para.
export async function PATCH(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('timelapse_jobs')
    .update({ status: 'cancelado', finished_at: new Date().toISOString(), mensagem: 'Cancelado pelo painel' })
    .eq('id', id)
    .in('status', ['pendente', 'processando'])
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ job: data });
}
