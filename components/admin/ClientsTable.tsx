'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ClientRow } from '@/lib/types/database';

const selectClass =
  'rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 ' +
  'focus:border-lime-400/60 focus:outline-none';

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [year, setYear] = useState<string>('todos');
  const [projeto, setProjeto] = useState<string>('todos');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Anos trabalhados = anos em que houve cadastro de cliente.
  const years = useMemo(
    () =>
      [...new Set(clients.map((c) => new Date(c.created_at).getFullYear()))].sort((a, b) => b - a),
    [clients]
  );

  const projetosUsados = useMemo(
    () => [...new Set(clients.flatMap((c) => c.projetos ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [clients]
  );

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const term = q.trim().toLowerCase();
        if (
          term &&
          !c.name.toLowerCase().includes(term) &&
          !c.slug.toLowerCase().includes(term) &&
          !(c.created_by ?? '').toLowerCase().includes(term) &&
          !(c.projetos ?? []).some((p) => p.toLowerCase().includes(term))
        ) {
          return false;
        }
        if (status === 'ativos' && !c.is_active) return false;
        if (status === 'inativos' && c.is_active) return false;
        if (year !== 'todos' && new Date(c.created_at).getFullYear() !== Number(year)) return false;
        if (projeto !== 'todos' && !(c.projetos ?? []).includes(projeto)) return false;
        return true;
      }),
    [clients, q, status, year, projeto]
  );

  async function toggleStatus(client: ClientRow) {
    setTogglingId(client.id);
    await fetch(`/api/admin/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !client.is_active }),
    });
    setTogglingId(null);
    router.refresh();
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, slug ou responsável..."
          className="min-w-56 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none"
          aria-label="Buscar clientes"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={selectClass}
          aria-label="Filtrar por status"
        >
          <option value="todos">Todos os status</option>
          <option value="ativos">Somente ativos</option>
          <option value="inativos">Somente inativos</option>
        </select>
        <select
          value={projeto}
          onChange={(e) => setProjeto(e.target.value)}
          className={selectClass}
          aria-label="Filtrar por projeto"
        >
          <option value="todos">Todos os projetos</option>
          {projetosUsados.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={selectClass}
          aria-label="Filtrar por ano trabalhado"
        >
          <option value="todos">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">
          {filtered.length} de {clients.length} cliente{clients.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Portal</th>
              <th className="px-5 py-3 font-medium">Criado em</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-zinc-100">{c.name}</div>
                  <div className="mt-0.5 font-mono text-xs text-zinc-500">{c.slug}</div>
                  {(c.projetos ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(c.projetos ?? []).map((p) => (
                        <span key={p} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleStatus(c)}
                    disabled={togglingId === c.id}
                    title={
                      c.is_active
                        ? 'Clique para desativar (o portal deste cliente sai do ar)'
                        : 'Clique para ativar (o portal deste cliente volta ao ar)'
                    }
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-lime-400/40 disabled:opacity-40 ${
                      c.is_active ? 'bg-lime-400/10 text-lime-300' : 'bg-zinc-500/10 text-zinc-400'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${c.is_active ? 'bg-lime-400' : 'bg-zinc-500'}`}
                      aria-hidden
                    />
                    {togglingId === c.id ? '...' : c.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    href={`/cliente/${c.slug}`}
                    target="_blank"
                    className="font-mono text-xs text-lime-400/90 hover:text-lime-300 hover:underline"
                  >
                    /cliente/{c.slug} ↗
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-sm text-zinc-400">
                  {new Date(c.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  <div className="mt-0.5 text-xs text-zinc-600">
                    {c.created_by ? `por ${c.created_by}` : '—'}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/admin/clientes/${c.slug}`}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/5"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  {clients.length === 0 ? (
                    <>
                      <p className="text-sm text-zinc-400">Nenhum cliente cadastrado ainda.</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Crie o primeiro em &quot;+ Novo cliente&quot; — nome, logo e o ZIP das camadas.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Nenhum cliente encontrado com esses filtros.
                    </p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
