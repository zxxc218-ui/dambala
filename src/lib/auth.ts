import { NextRequest } from 'next/server';

export interface UserProfile {
  username: string;
  role: 'admin' | 'caller' | 'checker' | 'viewer';
}

export const USER_COOKIE_NAME = 'tambola_user_session';
export const ADMIN_COOKIE_NAME = 'tambola_admin_token';
export const ADMIN_TOKEN_VALUE = 'tambola_secret_admin_session_token_2026';

export function getUserSession(req: NextRequest): UserProfile | null {
  const cookie = req.cookies.get(USER_COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    return JSON.parse(decoded) as UserProfile;
  } catch {
    return null;
  }
}

export function hasRole(req: NextRequest, allowedRoles: ('admin' | 'caller' | 'checker' | 'viewer')[]): boolean {
  const session = getUserSession(req);
  if (!session) return false;
  return allowedRoles.includes(session.role);
}

export function isAdmin(req: NextRequest): boolean {
  return hasRole(req, ['admin']);
}
