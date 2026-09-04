import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

/**
 * Server-side client for tables the public key must never touch — above all
 * `app_users`, which holds password hashes.
 *
 * Set SUPABASE_SERVICE_ROLE_KEY in the environment (Vercel → Settings →
 * Environment Variables). Until it is set this falls back to the anon client so
 * nothing breaks, but the users table then has to stay readable by the anon
 * key, which is not safe for real accounts — `hasServiceRole` reports which
 * mode is active so the setup screen can say so plainly.
 */
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasServiceRole = Boolean(serviceRoleKey && serviceRoleKey.length > 20);

export const supabaseAdmin = hasServiceRole
  ? createClient(supabaseUrl, serviceRoleKey as string, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : supabase;
