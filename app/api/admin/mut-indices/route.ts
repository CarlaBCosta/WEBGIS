import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Importa o CSV de índices de vegetação (migration 0010). A exportação do QGIS
// tem uma linha por fazenda, classe de uso e data:
//   FAZENDA, CLASSE_08, Data_Fmt, NDVI, EVI
// O portal desenha, no painel da fazenda, uma linha por classe.

const LOTE = 2000;

// Divide uma linha de CSV respeitando aspas.
function celulas(linha: string): string[] {
  const saida: string[] = [];
  let atual = '';
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if ((c === ',' || c === ';') && !dentroDeAspas) {
      saida.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  saida.push(atual);
  return saida.map((v) => v.trim());
}

function numero(valor: string | undefined): number | null {
  if (valor === undefined || valor === '') return null;
  const n = Number(valor.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Aceita 2007-05-15 e 15/05/2007.
function data(valor: string | undefined): string | null {
  if (!valor) return null;
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const { count, error } = await supabaseAdmin
    .from('mut_indices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (error) return NextResponse.json({ linhas: 0 });
  return NextResponse.json({ linhas: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const clientId = form.get('clientId') as string | null;

  if (!file || !clientId) {
    return NextResponse.json({ error: 'Envie o arquivo e o cliente.' }, { status: 400 });
  }

  const texto = await file.text();
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length < 2) {
    return NextResponse.json({ error: 'O arquivo está vazio.' }, { status: 400 });
  }

  const cabecalho = celulas(linhas[0].replace(/^﻿/, '')).map((c) => c.toUpperCase());
  const indice = (...nomes: string[]) => {
    for (const nome of nomes) {
      const i = cabecalho.indexOf(nome);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iCodigo = indice('FAZENDA', 'CODIGO', 'COD_FAZENDA');
  const iClasse = indice('CLASSE_08', 'CLASSE', 'USO');
  const iData = indice('DATA_FMT', 'DATA', 'DATE');
  const iNdvi = indice('NDVI');
  const iEvi = indice('EVI');

  if (iCodigo < 0 || iClasse < 0 || iData < 0 || (iNdvi < 0 && iEvi < 0)) {
    return NextResponse.json(
      {
        error:
          'O arquivo precisa das colunas FAZENDA, CLASSE_08, Data_Fmt e NDVI/EVI. ' +
          `Colunas encontradas: ${cabecalho.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  const registros: {
    client_id: string;
    codigo: string;
    classe: string;
    data: string;
    ndvi: number | null;
    evi: number | null;
  }[] = [];
  let ignoradas = 0;

  for (let i = 1; i < linhas.length; i++) {
    const c = celulas(linhas[i]);
    const dia = data(c[iData]);
    const codigo = (c[iCodigo] ?? '').trim();
    if (!dia || !codigo) {
      ignoradas++;
      continue;
    }
    registros.push({
      client_id: clientId,
      codigo,
      classe: (c[iClasse] ?? '').trim(),
      data: dia,
      ndvi: iNdvi >= 0 ? numero(c[iNdvi]) : null,
      evi: iEvi >= 0 ? numero(c[iEvi]) : null,
    });
  }

  if (registros.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha válida no arquivo.' }, { status: 400 });
  }

  // Substitui a importação anterior inteira: o CSV é a fonte da verdade.
  const { error: erroApagar } = await supabaseAdmin.from('mut_indices').delete().eq('client_id', clientId);
  if (erroApagar) return NextResponse.json({ error: erroApagar.message }, { status: 500 });

  for (let i = 0; i < registros.length; i += LOTE) {
    const { error } = await supabaseAdmin.from('mut_indices').insert(registros.slice(i, i + LOTE));
    if (error) {
      return NextResponse.json(
        { error: `Falha ao gravar a partir da linha ${i + 2}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  const fazendas = new Set(registros.map((r) => r.codigo)).size;
  const classes = new Set(registros.map((r) => r.classe)).size;
  return NextResponse.json({ linhas: registros.length, fazendas, classes, ignoradas });
}

export async function DELETE(request: NextRequest) {
  const { clientId } = await request.json();
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('mut_indices').delete().eq('client_id', clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
