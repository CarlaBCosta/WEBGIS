import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ClientRow, LayerGroupRow } from '@/lib/types/database';
import { GeojsonUploadForm } from '@/components/admin/GeojsonUploadForm';

export default async function UploadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ClientRow>();

  if (!client) notFound();

  const { data: groups } = await supabaseAdmin
    .from('layer_groups')
    .select('*')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: true })
    .returns<LayerGroupRow[]>();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Upload de camada - {client.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Envie um arquivo .geojson exportado do QGIS. Se as coordenadas estiverem em SIRGAS 2000 / UTM 22S
        (EPSG:31982), marque a opção de reprojeção abaixo.
      </p>
      {(!groups || groups.length === 0) ? (
        <p className="text-sm text-amber-400">
          Crie pelo menos um grupo de camadas na aba &quot;Camadas&quot; antes de enviar um arquivo.
        </p>
      ) : (
        <GeojsonUploadForm slug={slug} groups={groups} />
      )}
    </div>
  );
}
