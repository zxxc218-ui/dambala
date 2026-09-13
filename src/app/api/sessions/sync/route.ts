import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession, UserProfile } from '@/lib/auth';
import { clearSessionCache } from '@/lib/sessions';
import { isMissingPrizesColumn, normalizePrizes } from '@/lib/prizes';

/**
 * Upload a whole game in one request.
 *
 * The game is played on the device with no network at all, and told to the
 * server afterwards. That makes this the only write path a game needs, and it
 * is deliberately a *replace*, not a merge: the device holds the complete and
 * ordered truth about what came out of the drum, so the server's copy of this
 * session is made to match it exactly rather than being patched number by
 * number. Replaying ninety separate requests is what produced gaps and
 * duplicate draw orders before.
 *
 * Sending the same game twice is safe. The first upload gets a row id back and
 * the device keeps it, so the second upload overwrites the same row instead of
 * creating a second one.
 */

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
}

/** The numbers as drawn: whole, in range, no repeats, in order. */
function cleanNumbers(raw: any): { numbers: number[]; rejected: number } {
  if (!Array.isArray(raw)) return { numbers: [], rejected: 0 };
  const seen = new Set<number>();
  const numbers: number[] = [];
  let rejected = 0;
  for (const entry of raw) {
    const n = Number(entry);
    if (!Number.isInteger(n) || n < 1 || n > 90 || seen.has(n)) {
      rejected++;
      continue;
    }
    seen.add(n);
    numbers.push(n);
  }
  return { numbers, rejected };
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { numbers, rejected } = cleanNumbers(body?.numbers);
    const prizes = normalizePrizes(body?.prizes);
    const status: string = ['active', 'paused', 'finished'].includes(body?.status)
      ? body.status
      : 'finished';
    const name = String(body?.name || '').trim() || `جلسة سحب دمبلة - ${new Date().toLocaleString('ar-EG')}`;
    const startedAt = body?.startedAt ? new Date(body.startedAt) : new Date();
    const endedAt = body?.endedAt ? new Date(body.endedAt) : null;

    /* ---------- 1. find the row this game belongs to, or make one ---------- */

    let sessionId: number | null = null;

    const claimed = Number(body?.serverId);
    if (Number.isFinite(claimed) && claimed > 0) {
      // A device may only overwrite its own club's session.
      const { data: owned, error } = await scoped(
        supabase.from('draw_sessions').select('id').eq('id', claimed),
        user
      ).maybeSingle();

      if (error) throw error;
      if (owned) sessionId = Number((owned as any).id);
    }

    let prizesStored = true;

    if (sessionId === null) {
      // A new game closes whatever this club had open — the same rule the old
      // start button followed, kept so two devices cannot leave two live games.
      const { error: closeErr } = await scoped(
        supabase
          .from('draw_sessions')
          .update({ status: 'finished', ended_at: new Date().toISOString() })
          .in('status', ['active', 'paused']),
        user
      );
      if (closeErr) throw closeErr;

      const baseRow: Record<string, any> = {
        name,
        status,
        club_id: user.clubId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt ? endedAt.toISOString() : null,
      };

      let { data: created, error: createErr } = await supabase
        .from('draw_sessions')
        .insert({ ...baseRow, prizes })
        .select('id')
        .single();

      // db/prizes.sql not run yet: store the game, lose only the prize rules.
      if (createErr && isMissingPrizesColumn(createErr)) {
        prizesStored = false;
        ({ data: created, error: createErr } = await supabase
          .from('draw_sessions')
          .insert(baseRow)
          .select('id')
          .single());
      }

      if (createErr || !created) throw createErr || new Error('تعذر إنشاء الجلسة');
      sessionId = Number(created.id);
    } else {
      const patch: Record<string, any> = {
        name,
        status,
        ended_at: endedAt ? endedAt.toISOString() : null,
      };

      let { error: patchErr } = await supabase
        .from('draw_sessions')
        .update({ ...patch, prizes })
        .eq('id', sessionId);

      if (patchErr && isMissingPrizesColumn(patchErr)) {
        prizesStored = false;
        ({ error: patchErr } = await supabase
          .from('draw_sessions')
          .update(patch)
          .eq('id', sessionId));
      }

      if (patchErr) throw patchErr;
    }

    /* ---------- 2. make the stored numbers match the device exactly ---------- */

    const { error: wipeErr } = await supabase
      .from('draw_numbers')
      .delete()
      .eq('session_id', sessionId);

    if (wipeErr) throw wipeErr;

    if (numbers.length > 0) {
      const rows = numbers.map((number, i) => ({
        session_id: sessionId,
        number,
        draw_order: i + 1,
      }));

      // one insert per chunk, in order, so a long game does not hit a body limit
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: insertErr } = await supabase
          .from('draw_numbers')
          .insert(rows.slice(i, i + CHUNK));
        if (insertErr) throw insertErr;
      }
    }

    // Prove it landed rather than assuming: the device only marks a game synced
    // on a count it can trust.
    const { count, error: countErr } = await supabase
      .from('draw_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (countErr) throw countErr;

    clearSessionCache(user);

    return NextResponse.json({
      success: true,
      serverId: sessionId,
      count: count ?? numbers.length,
      rejected,
      prizesStored,
      message: `تمت مزامنة ${count ?? numbers.length} رقم`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذرت مزامنة الجلسة: ' + error.message },
      { status: 500 }
    );
  }
}
