import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'tambola_session';

/** Pages anyone may reach without signing in. */
const PUBLIC_PATHS = ['/login', '/setup'];

/**
 * Sends signed-out visitors to the login page instead of letting them land on a
 * blank app screen.
 *
 * This runs at the edge and only checks that a session cookie is present — it
 * deliberately does not try to verify the signature, because the real check
 * needs Node's crypto. Every API route validates the signed cookie itself, so
 * a forged or expired cookie gets a visitor no further than an empty screen.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except API routes (they answer 401 themselves), Next internals,
  // and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
