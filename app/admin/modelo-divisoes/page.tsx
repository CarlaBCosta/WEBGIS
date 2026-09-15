import { supabaseAdmin } from '@/lib/supabase/server';
import type { LayerGroupTemplateRow } from '@/lib/types/database';
import { TemplateEditor } from '@/components/admin/TemplateEditor';

export default async function ModeloDivisoesPage() {
  const { data: templates, error } = await supabaseAdmin
    .from('layer_group_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .returns<LayerGroupTemplateRow[]>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Modelo de divisões</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Divisões que todo cliente novo recebe, na ordem do portal. As palavras-chave classificam sozinhas as
          camadas enviadas no cadastro pelo nome do arquivo. Mudanças aqui não alteram clientes existentes.
        </p>
      </div>
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Erro ao carregar o modelo: {error.message}
        </p>
      )}
      <TemplateEditor templates={templates ?? []} />
    </div>
  );
}
