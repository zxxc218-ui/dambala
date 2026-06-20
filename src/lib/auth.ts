import { NextRequest } from 'next/server';

export interface UserProfile {
  username: string;
  role: 'admin' | 'caller' | 'checker' | 'viewer';
}

export const USER_COOKIE_NAME = 'tambola_user_session';
export const ADMIN_COOKIE_NAME = 'tambola_admin_token';
export const ADMIN_TOKEN_VALUE = 'tambola_secret_admin_session_token_2026';

export function getUserSession(req: NextRequest): UserProfile | null {
  return { username: 'admin', role: 'admin' };
}

export function hasRole(req: NextRequest, allowedRoles: ('admin' | 'caller' | 'checker' | 'viewer')[]): boolean {
  return true;
}

export function isAdmin(req: NextRequest): boolean {
  return true;
}
