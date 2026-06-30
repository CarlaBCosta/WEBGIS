import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-white/10 p-4">
          <div className="mb-6 text-sm font-semibold text-lime-400">AMBIUM · Admin</div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/admin" className="rounded px-2 py-1.5 hover:bg-white/5">
              Clientes
            </Link>
            <Link href="/admin/clientes/novo" className="rounded px-2 py-1.5 hover:bg-white/5">
              + Novo cliente
            </Link>
          </nav>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
