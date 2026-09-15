'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/admin',
    label: 'Clientes',
    // Ativo também nas telas internas de um cliente (editar/camadas/upload)
    isActive: (path: string) =>
      path === '/admin' || (path.startsWith('/admin/clientes/') && path !== '/admin/clientes/novo'),
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 15.3A5.5 5.5 0 0 1 7 10.5a5.5 5.5 0 0 1 5.5 4.8l.1.9a.7.7 0 0 1-.7.8H2.1a.7.7 0 0 1-.7-.8l.1-.9ZM14.5 10.5c-.4 0-.8 0-1.2.1a7 7 0 0 1 1.6 3.6l.1 1.3h3.3a.7.7 0 0 0 .7-.8l-.1-.6a4.5 4.5 0 0 0-4.4-3.6Z" />
      </svg>
    ),
  },
  {
    href: '/admin/clientes/novo',
    label: 'Novo cliente',
    isActive: (path: string) => path === '/admin/clientes/novo',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M10 3.5a.9.9 0 0 1 .9.9v4.7h4.7a.9.9 0 1 1 0 1.8h-4.7v4.7a.9.9 0 1 1-1.8 0v-4.7H4.4a.9.9 0 1 1 0-1.8h4.7V4.4a.9.9 0 0 1 .9-.9Z" />
      </svg>
    ),
  },
  {
    href: '/admin/modelo-divisoes',
    label: 'Modelo de divisões',
    isActive: (path: string) => path === '/admin/modelo-divisoes',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
        <path d="M3.5 4.5A1.5 1.5 0 0 1 5 3h10a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 15 7H5a1.5 1.5 0 0 1-1.5-1.5v-1ZM3.5 9.5A1.5 1.5 0 0 1 5 8h10a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 15 12H5a1.5 1.5 0 0 1-1.5-1.5v-1ZM5 13a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 15 13H5Z" />
      </svg>
    ),
  },
];

export function AdminSidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900/40">
      <div className="border-b border-white/10 px-4 py-5">
        <span className="flex items-center justify-center rounded-xl bg-[#f5f6f7] px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="AMBIUM Digital" className="h-9 w-full object-contain" />
        </span>
        <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-300/90">
          Painel administrativo
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-lime-400/10 font-medium text-lime-300'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 px-5 py-4 text-[11px] text-zinc-600">
        {userName ? (
          <>
            Logado como <span className="font-medium text-zinc-400">{userName}</span>
          </>
        ) : (
          'Portal WebGIS · multi-cliente'
        )}
      </div>
    </aside>
  );
}
