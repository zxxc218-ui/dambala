import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/lib/auth';

/**
 * Every club plays its own game. `draw_sessions.club_id` holds the id of the
 * club account that owns the session, so two clubs drawing at the same time
 * never see each other's numbers. The super admin has no club of its own and
 * sees whichever session it started (club_id is null there).
 */

export interface ActiveSession {
  id: number | string;
  name: string;
  status: string;
}

/**
 * The active/paused session belonging to this user.
 *
 * Cached per club for a few seconds: drawing and undoing both need the session
 * id first, and re-reading it on every keystroke was a whole round trip of the
 * delay the caller feels.
 */
const CACHE_MS = 8000;
const cache = new Map<string, { session: ActiveSession | null; at: number }>();

function cacheKey(user: UserProfile) {
  return user.role === 'super_admin' ? 'super:' + user.username : 'club:' + user.clubId;
}

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
}

export async function getActiveSession(
  user: UserProfile,
  statuses: string[] = ['active', 'paused']
): Promise<{ session: ActiveSession | null; error?: any }> {
  const key = cacheKey(user) + ':' + statuses.join(',');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { session: hit.session };

  const { data, error } = await scoped(
    supabase.from('draw_sessions').select('id, name, status').in('status', statuses),
    user
  )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { session: null, error };

  const session = (data as ActiveSession) || null;
  cache.set(key, { session, at: Date.now() });
  return { session };
}

/** Call after starting, finishing, pausing or resetting a session. */
export function clearSessionCache(user?: UserProfile) {
  if (!user) {
    cache.clear();
    return;
  }
  const prefix = cacheKey(user);
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Value to store in `draw_sessions.club_id` for this user. */
export function clubIdFor(user: UserProfile): number | null {
  return user.clubId;
}
