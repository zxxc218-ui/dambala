import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession, UserProfile } from '@/lib/auth';
import { getCardIndex } from '@/lib/cards';
import {
  DEFAULT_PRIZES,
  computeStandings,
  isMissingPrizesColumn,
  normalizePrizes,
  orderMap,
  toStatus,
} from '@/lib/prizes';

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
}

const WITH_PRIZES = `
  id,
  name,
  status,
  started_at,
  ended_at,
  prizes,
  draw_numbers (
    number,
    draw_order
  )
`;

const WITHOUT_PRIZES = `
  id,
  name,
  status,
  started_at,
  ended_at,
  draw_numbers (
    number,
    draw_order
  )
`;

/**
 * The prize rules the start screen should open on: whatever this club used last
 * time. Saves re-typing the same counts before every game.
 */
async function lastUsedPrizes(user: UserProfile) {
  const { data, error } = await scoped(
    supabase.from('draw_sessions').select('prizes').not('prizes', 'is', null),
    user
  )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_PRIZES;
  return normalizePrizes((data as any).prizes);
}

export async function GET(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    // A club only ever sees its own game.
    const read = async (columns: string) =>
      scoped(supabase.from('draw_sessions').select(columns).in('status', ['active', 'paused']), user)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let { data: dbSession, error } = (await read(WITH_PRIZES)) as any;

    // db/prizes.sql not run yet — carry on without the column.
    let prizesColumnMissing = false;
    if (error && isMissingPrizesColumn(error)) {
      prizesColumnMissing = true;
      ({ data: dbSession, error } = (await read(WITHOUT_PRIZES)) as any);
    }

    if (error) throw error;

    if (!dbSession) {
      // No game running: hand back the rules to pre-fill the start screen with.
      const lastPrizes = prizesColumnMissing ? DEFAULT_PRIZES : await lastUsedPrizes(user);
      return NextResponse.json({
        success: true,
        session: null,
        lastPrizes,
        prizesColumnMissing,
      });
    }

    // Format numbers sorted by draw_order
    const numbers = (dbSession.draw_numbers || []).map((n: any) => ({
      number: n.number,
      drawOrder: n.draw_order,
    }));
    numbers.sort((a: any, b: any) => a.drawOrder - b.drawOrder);

    const prizes = normalizePrizes(dbSession.prizes);

    // Live prize counters, worked out from the numbers on the board. Nothing is
    // stored, so an undone number gives its prize back by itself.
    let prizeStatus = null;
    try {
      const index = await getCardIndex();
      const standings = computeStandings(
        index,
        orderMap((dbSession.draw_numbers || []) as any),
        prizes
      );
      prizeStatus = toStatus(standings);
    } catch {
      // the board still works without the counters
    }

    const formattedSession = {
      id: dbSession.id,
      name: dbSession.name,
      status: dbSession.status,
      startedAt: dbSession.started_at,
      endedAt: dbSession.ended_at,
      numbers,
      prizes,
    };

    return NextResponse.json({
      success: true,
      session: formattedSession,
      prizeStatus,
      prizesColumnMissing,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب الجلسة الحالية من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
