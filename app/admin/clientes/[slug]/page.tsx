import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ClientRow } from '@/lib/types/database';
import { ClientForm } from '@/components/admin/ClientForm';

export default async function EditClientePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ClientRow>();

  if (!client) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{client.name}</h1>
        <div className="flex gap-4 text-sm">
          <Link href={`/admin/clientes/${slug}/camadas`} className="text-lime-400 hover:underline">
            Camadas
          </Link>
          <Link href={`/admin/clientes/${slug}/upload`} className="text-lime-400 hover:underline">
            Upload de GeoJSON
          </Link>
        </div>
      </div>
      <ClientForm initial={client} />
    </div>
  );
}
