import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token, maxAge } = await req.json();
  if (!token) return NextResponse.json({ ok: false, error: 'NO_TOKEN' }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: true,          // в проде всегда true
    sameSite: 'lax',
    path: '/',
    maxAge: typeof maxAge === 'number' ? maxAge : 60 * 60 * 24 * 30, // 30 дней
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('token', '', { path: '/', maxAge: 0 });
  return res;
}
