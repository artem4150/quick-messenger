import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const url = req.nextUrl;

  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');

  if (!token && !isAuthPage) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // если уже авторизован и пришёл на /login|/register — отправим на главную
  if (token && isAuthPage) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// какие пути защищаем
export const config = {
  matcher: [
    '/',                 // главная
    '/chat/:path*',
    '/call/:path*',
    '/settings/:path*',
    // можно добавить любые приватные разделы
    '/login',
    '/register',
  ],
};
