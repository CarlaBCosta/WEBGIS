import { supabaseAdmin } from '@/lib/supabase/server';
import type { MutClasseRow } from '@/lib/types/database';
import { MutClassesEditor } from '@/components/admin/MutClassesEditor';

export default async function ClassesMutPage() {
  const { data: classes, error } = await supabaseAdmin
    .from('mut_classes')
    .select('*')
    .is('client_id', null)
    .order('sort_order', { ascending: true })
    .returns<MutClasseRow[]>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Classes de uso do solo</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cores da legenda da visão MUT, na ordem em que aparecem no portal. O nome precisa ser igual ao que
          vem no campo de uso do solo do GeoJSON; classe que não estiver aqui é desenhada em cinza.
        </p>
      </div>
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Erro ao carregar as classes: {error.message}
        </p>
      )}
      <MutClassesEditor classes={classes ?? []} />
    </div>
  );
}
