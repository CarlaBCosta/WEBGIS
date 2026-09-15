import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CAMPO_FAZENDA_PADRAO, escolherCampoCodigo } from '@/lib/timelapse';
import { lerCamposDaCamada } from '@/lib/timelapseServidor';

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

  // Confere, antes de pôr na fila, se a camada tem o campo do código. Se o campo
  // informado não existir, usa o primeiro campo de fazenda do cliente presente
  // no arquivo; se nenhum existir, recusa com os campos disponíveis.
  const [{ data: camada }, { data: cliente }] = await Promise.all([
    supabaseAdmin.from('layers').select('storage_path, label').eq('client_id', clientId).eq('layer_key', layerKey).maybeSingle(),
    supabaseAdmin.from('clients').select('farm_code_fields').eq('id', clientId).maybeSingle(),
  ]);
  if (!camada?.storage_path) {
    return NextResponse.json({ error: 'Essa camada não existe ou ainda não tem arquivo enviado.' }, { status: 400 });
  }

  let campoFinal: string = campo || CAMPO_FAZENDA_PADRAO;
  const campos = await lerCamposDaCamada(camada.storage_path);
  if (campos.length > 0 && !campos.includes(campoFinal)) {
    const alternativo = escolherCampoCodigo(campos, [campoFinal, ...((cliente?.farm_code_fields as string[]) ?? [])]);
    if (!alternativo) {
      return NextResponse.json(
        {
          error:
            `A camada "${camada.label}" não tem código de fazenda (campo "${campoFinal}"). ` +
            `Campos dela: ${campos.join(', ')}. Escolha a camada das fazendas/talhões ou digite o campo certo.`,
        },
        { status: 400 }
      );
    }
    campoFinal = alternativo;
  }

  const rawUser = request.cookies.get('admin_user')?.value;

  const { data, error } = await supabaseAdmin
    .from('timelapse_jobs')
    .insert({
      client_id: clientId,
      layer_key: layerKey,
      campo: campoFinal,
      sensor: sensor === 'sentinel2' ? 'sentinel2' : 'landsat',
      criado_por: rawUser ? decodeURIComponent(rawUser) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ job: data, campoAjustado: campoFinal !== (campo || CAMPO_FAZENDA_PADRAO) }, { status: 201 });
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
