import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Roles
 * - `super_admin` owns the system: manages clubs and users, edits sets.
 * - `club` runs its own games: draws, undo, checking, sets — but only ever
 *   sees and touches its own club's play sessions.
 */
export type Role = 'super_admin' | 'club';

export interface UserProfile {
  username: string;
  role: Role;
  clubName: string | null;
  /** which club's data this user works inside; null for the super admin */
  clubId: number | null;
}

export const USER_COOKIE_NAME = 'tambola_session';

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

/**
 * Secret used to sign session cookies.
 * Set SESSION_SECRET in the environment. Without it the app falls back to a
 * per-deployment value derived from the Supabase keys, which still prevents
 * outsiders forging a cookie but logs everyone out on each deploy.
 */
function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  return (
    'fallback:' +
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev') +
    ':' +
    (process.env.VERCEL_DEPLOYMENT_ID || 'local')
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload: string): string {
  return base64url(crypto.createHmac('sha256', sessionSecret()).update(payload).digest());
}

/**
 * Build a signed session cookie value.
 * The payload is readable but not forgeable: changing a single character of it
 * invalidates the signature. The old scheme was plain base64 of the profile,
 * so anyone could hand themselves the admin role by editing their own cookie.
 */
export function createSessionToken(user: UserProfile): string {
  const body = {
    u: user.username,
    r: user.role,
    c: user.clubId,
    n: user.clubName,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = base64url(JSON.stringify(body));
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): UserProfile | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(payload);
  // constant-time compare, and only when the lengths already match
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const body = JSON.parse(fromBase64url(payload).toString('utf-8'));
    if (!body || typeof body.u !== 'string') return null;
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null;
    if (body.r !== 'super_admin' && body.r !== 'club') return null;

    return {
      username: body.u,
      role: body.r,
      clubId: typeof body.c === 'number' ? body.c : null,
      clubName: typeof body.n === 'string' ? body.n : null,
    };
  } catch {
    return null;
  }
}

export function getUserSession(req: NextRequest): UserProfile | null {
  return readSessionToken(req.cookies.get(USER_COOKIE_NAME)?.value);
}

export function hasRole(req: NextRequest, allowedRoles: Role[]): boolean {
  const session = getUserSession(req);
  return !!session && allowedRoles.includes(session.role);
}

export function isSuperAdmin(req: NextRequest): boolean {
  return hasRole(req, ['super_admin']);
}

/** Anyone signed in — a club or the super admin. */
export function isSignedIn(req: NextRequest): boolean {
  return getUserSession(req) !== null;
}

/** Kept for older call sites: the super admin is the app's administrator. */
export function isAdmin(req: NextRequest): boolean {
  return isSuperAdmin(req);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_TTL_SECONDS,
  path: '/',
};

/* ------------------------------------------------------------------------- *
 * Password hashing — scrypt from Node's own crypto, no dependency to install.
 * Stored as: scrypt$<N>$<r>$<p>$<salt-b64>$<hash-b64>
 * ------------------------------------------------------------------------- */

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p, maxmem: 64 * 1024 * 1024 },
      (err, derived) => (err ? reject(err) : resolve(derived as Buffer))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');

  const derived: Buffer = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
      (err, out) => (err ? reject(err) : resolve(out as Buffer))
    );
  });

  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

/** Basic rules so a club account cannot be created with a guessable password. */
export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'كلمة السر يجب أن تكون 8 خانات على الأقل';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'كلمة السر يجب أن تحتوي على حروف وأرقام';
  }
  return null;
}

export function usernameProblem(username: string): string | null {
  if (typeof username !== 'string') return 'اسم المستخدم غير صالح';
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) {
    return 'اسم المستخدم يجب أن يكون بين 3 و 32 خانة';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'اسم المستخدم يقبل الحروف الإنجليزية والأرقام والنقطة والشرطة فقط';
  }
  return null;
}
