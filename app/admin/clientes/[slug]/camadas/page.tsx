import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ClientRow, LayerGroupWithLayersRow } from '@/lib/types/database';
import { LayerGroupEditor } from '@/components/admin/LayerGroupEditor';

export default async function CamadasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ClientRow>();

  if (!client) notFound();

  const { data: groups } = await supabaseAdmin
    .from('layer_groups')
    .select('*, layers(*)')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: true })
    .returns<LayerGroupWithLayersRow[]>();

  (groups || []).forEach((g) => g.layers.sort((a, b) => a.sort_order - b.sort_order));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Camadas de {client.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Grupos e camadas, na ordem em que aparecem no painel. Use os botões ↑/↓ para reordenar.
      </p>
      <LayerGroupEditor clientId={client.id} initialGroups={groups || []} />
    </div>
  );
}
