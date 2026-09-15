import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/server';

// Tipos de projeto cadastrados no banco (migration 0008). Sem a migration,
// devolve lista vazia e o formulário mostra o aviso.
export async function carregarTiposProjeto(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('tipos_projeto')
    .select('nome')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data.map((t) => t.nome as string);
}
