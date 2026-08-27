import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ClientRow } from '@/lib/types/database';
import { ClientsTable } from '@/components/admin/ClientsTable';

export default async function AdminDashboard() {
  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<ClientRow[]>();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cada cliente tem um portal próprio em <code className="font-mono text-xs">/cliente/&lt;slug&gt;</code>.
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
        >
          + Novo cliente
        </Link>
      </div>

      {error && (
        <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Erro ao consultar clientes: {error.message}. Verifique SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.
        </p>
      )}

      <ClientsTable clients={clients ?? []} />
    </div>
  );
}
