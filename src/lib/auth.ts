import { NextRequest } from 'next/server';

export const ADMIN_COOKIE_NAME = 'tambola_admin_token';
export const ADMIN_TOKEN_VALUE = 'tambola_secret_admin_session_token_2026';

export function isAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  return cookie?.value === ADMIN_TOKEN_VALUE;
}
