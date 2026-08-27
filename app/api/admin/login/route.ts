import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';

export async function POST(request: NextRequest) {
  const { password, userName } = await request.json();

  if (!process.env.ADMIN_PANEL_SECRET || password !== process.env.ADMIN_PANEL_SECRET) {
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, process.env.ADMIN_PANEL_SECRET, cookieOptions);
  // Identifica quem está operando o painel (auditoria "criado por").
  if (typeof userName === 'string' && userName.trim()) {
    response.cookies.set('admin_user', encodeURIComponent(userName.trim().slice(0, 80)), cookieOptions);
  }
  return response;
}
