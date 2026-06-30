import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PANEL_SECRET || password !== process.env.ADMIN_PANEL_SECRET) {
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, process.env.ADMIN_PANEL_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
