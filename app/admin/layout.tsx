import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const rawUser = (await cookies()).get('admin_user')?.value;
  const userName = rawUser ? decodeURIComponent(rawUser) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">
        <AdminSidebar userName={userName} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
