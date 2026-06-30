import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';

// Lightweight gate for /admin/* and /api/admin/* - not real auth, just a
// single shared-secret cookie check. Isolating every admin mutation behind
// this one choke point means swapping in Supabase Auth + RLS roles later
// only touches this file and the login route, not every API handler.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminLogin = pathname === '/admin/login' || pathname === '/api/admin/login';
  const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (!isAdminArea || isAdminLogin) return NextResponse.next();

  const session = request.cookies.get(COOKIE_NAME)?.value;
  if (session === process.env.ADMIN_PANEL_SECRET) return NextResponse.next();

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
