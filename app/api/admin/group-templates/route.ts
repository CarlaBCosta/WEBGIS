import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Taxonomia padrão de grupos temáticos (tabela layer_group_templates).
// Se a migration 0003 ainda não tiver sido aplicada, devolve lista vazia —
// o cadastro então usa um grupo único como antes.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('layer_group_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ templates: [] });
  return NextResponse.json({ templates: data });
}
