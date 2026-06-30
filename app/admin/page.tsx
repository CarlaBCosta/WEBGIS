import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ClientRow } from '@/lib/types/database';

export default async function AdminDashboard() {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<ClientRow[]>();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Clientes</h1>
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Link</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(clients || []).map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2 text-zinc-400">{c.slug}</td>
                <td className="px-4 py-2">
                  <span className={c.is_active ? 'text-lime-400' : 'text-zinc-500'}>
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/cliente/${c.slug}`} className="text-lime-400 hover:underline" target="_blank">
                    /cliente/{c.slug}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/clientes/${c.slug}`} className="text-zinc-300 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
