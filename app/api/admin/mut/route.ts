import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { lerCamposDaCamada } from '@/lib/timelapseServidor';
import { CAMPO_ELEGIBILIDADE_PADRAO, VALORES_ELEGIVEL_PADRAO, detectarCamposMut } from '@/lib/mut';

// Configuração da visão MUT de um cliente (tabela mut_config, migration 0009).
// Rota protegida pelo proxy.ts como as demais do painel.

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('mut_config')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data ?? null });
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function campoOpcional(valor: unknown): string | null {
  const v = texto(valor);
  return v || null;
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const clientId = texto(body.clientId);
  const layerKey = texto(body.layerKey);

  if (!clientId || !layerKey) {
    return NextResponse.json({ error: 'Escolha a camada MUT do cliente.' }, { status: 400 });
  }

  const { data: camada } = await supabaseAdmin
    .from('layers')
    .select('storage_path, label')
    .eq('client_id', clientId)
    .eq('layer_key', layerKey)
    .maybeSingle();

  if (!camada?.storage_path) {
    return NextResponse.json(
      { error: 'Essa camada não existe ou ainda não tem arquivo enviado.' },
      { status: 400 }
    );
  }

  const campoCodigo = texto(body.campoCodigo);
  const campoElegibilidade = texto(body.campoElegibilidade) || CAMPO_ELEGIBILIDADE_PADRAO;
  if (!campoCodigo) {
    return NextResponse.json({ error: 'Informe o campo do código da fazenda.' }, { status: 400 });
  }

  // Confere contra os atributos reais do arquivo antes de salvar. Sem o código
  // da fazenda a visão não funciona — isso é erro. Os demais campos podem
  // chegar numa exportação futura (a elegibilidade, por exemplo): salva com
  // aviso, e o portal mostra só o que tem.
  const campos = await lerCamposDaCamada(camada.storage_path, 65536);
  const ausentes: string[] = [];
  if (campos.length) {
    const existe = (campo: string) => campos.some((c) => c.toUpperCase() === campo.toUpperCase());

    if (!existe(campoCodigo)) {
      return NextResponse.json(
        {
          error:
            `A camada "${camada.label}" não tem o código da fazenda ("${campoCodigo}"). ` +
            `Campos dela: ${campos.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    for (const [rotulo, campo] of [
      ['elegibilidade', campoElegibilidade],
      ['talhão', texto(body.campoTalhao)],
      ['área', texto(body.campoArea)],
      ['uso do solo', texto(body.campoUso)],
    ] as [string, string][]) {
      if (campo && !existe(campo)) ausentes.push(`${rotulo} ("${campo}")`);
    }
  }

  const valores = Array.isArray(body.valoresElegivel)
    ? body.valoresElegivel
    : texto(body.valoresElegivel).split(',');
  const valoresElegivel = [...new Set(valores.map(texto).filter(Boolean))];

  const { data, error } = await supabaseAdmin
    .from('mut_config')
    .upsert(
      {
        client_id: clientId,
        layer_key: layerKey,
        campo_codigo: campoCodigo,
        campo_talhao: campoOpcional(body.campoTalhao),
        campo_area: campoOpcional(body.campoArea),
        campo_elegibilidade: campoElegibilidade,
        valores_elegivel: valoresElegivel.length ? valoresElegivel : VALORES_ELEGIVEL_PADRAO,
        campo_uso: campoOpcional(body.campoUso),
        nome_fazenda: texto(body.nomeFazenda),
        safra: texto(body.safra),
        ano_inicial: Number(body.anoInicial) || 2007,
        ano_mut: Number(body.anoMut) || 2008,
        ativo: body.ativo !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Avisa quando falta alguma peça: a visão funciona, mostrando só o que a
  // camada tem hoje.
  const semUso = !data.campo_uso;
  return NextResponse.json({ config: data, semUso, ausentes });
}

export async function DELETE(request: NextRequest) {
  const { clientId } = await request.json();
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('mut_config').delete().eq('client_id', clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Usado pelo card quando a camada escolhida muda: devolve os atributos do
// arquivo e o palpite de qual campo é o quê.
export async function POST(request: NextRequest) {
  const { clientId, layerKey } = await request.json();
  if (!clientId || !layerKey) {
    return NextResponse.json({ error: 'clientId e layerKey obrigatórios.' }, { status: 400 });
  }

  const { data: camada } = await supabaseAdmin
    .from('layers')
    .select('storage_path')
    .eq('client_id', clientId)
    .eq('layer_key', layerKey)
    .maybeSingle();

  const campos = camada?.storage_path ? await lerCamposDaCamada(camada.storage_path, 65536) : [];
  return NextResponse.json({ campos, detectado: detectarCamposMut(campos) });
}
