import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession, UserProfile } from '@/lib/auth';
import { getCardIndex } from '@/lib/cards';
import {
  PRIZE_ORDER,
  PRIZE_LABELS,
  PrizeKey,
  computeStandings,
  isMissingPrizesColumn,
  normalizePrizes,
  orderMap,
} from '@/lib/prizes';

/**
 * Club reports: which numbers come up most, and which cards win most.
 *
 * Both are worked out from the drawn numbers themselves, exactly the way the
 * live board does it — no separate tally is kept, so a report can never drift
 * from what actually happened at the table. A card counts as a winner only for
 * prizes it really took: a line finished after that prize was full is not a win.
 *
 * Everything is scoped to the caller's own club.
 */

/** Reading every session a busy club ever played would be slow and pointless. */
const MAX_SESSIONS = 200;

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
}

interface CardTally {
  setNo: number;
  cardNo: number;
  wins: number;
  byPrize: Record<PrizeKey, number>;
  sessions: Set<string>;
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

    const url = new URL(req.url);
    /** '' or 'all' = every session; otherwise one session's id */
    const wanted = (url.searchParams.get('session') || '').trim();

    const cardIndexPromise = getCardIndex();

    // 1. This club's sessions, newest first.
    const readSessions = (columns: string) =>
      scoped(supabase.from('draw_sessions').select(columns), user)
        .order('started_at', { ascending: false })
        .limit(MAX_SESSIONS);

    const WITH_PRIZES = 'id, name, status, started_at, prizes';
    const WITHOUT_PRIZES = 'id, name, status, started_at';

    let { data: sessionRows, error: sessionErr } = (await readSessions(WITH_PRIZES)) as any;

    if (sessionErr && isMissingPrizesColumn(sessionErr)) {
      ({ data: sessionRows, error: sessionErr } = (await readSessions(WITHOUT_PRIZES)) as any);
    }

    if (sessionErr) throw sessionErr;

    const allSessions = (sessionRows || []) as any[];

    if (allSessions.length === 0) {
      return NextResponse.json({
        success: true,
        clubName: user.clubName,
        sessions: [],
        sessionsCount: 0,
        drawsCount: 0,
        numbers: [],
        cards: [],
        prizeTotals: {},
      });
    }

    const chosen =
      wanted && wanted !== 'all'
        ? allSessions.filter((s) => String(s.id) === wanted)
        : allSessions;

    if (chosen.length === 0) {
      return NextResponse.json(
        { success: false, message: 'الجلسة المطلوبة غير موجودة ضمن جلسات ناديك' },
        { status: 404 }
      );
    }

    // 2. Every number those sessions drew.
    const { data: drawRows, error: drawErr } = await supabase
      .from('draw_numbers')
      .select('session_id, number, draw_order')
      .in(
        'session_id',
        chosen.map((s) => s.id)
      );

    if (drawErr) throw drawErr;

    const rows = (drawRows || []) as { session_id: any; number: number; draw_order: number }[];

    // 3. How often each number came up.
    const numberCount = new Map<number, number>();
    const bySession = new Map<string, { number: number; draw_order: number }[]>();

    for (const r of rows) {
      numberCount.set(r.number, (numberCount.get(r.number) || 0) + 1);

      const key = String(r.session_id);
      const list = bySession.get(key);
      if (list) list.push({ number: r.number, draw_order: r.draw_order });
      else bySession.set(key, [{ number: r.number, draw_order: r.draw_order }]);
    }

    const numbers = [];
    for (let n = 1; n <= 90; n++) {
      numbers.push({ number: n, count: numberCount.get(n) || 0 });
    }
    // most drawn first; equal counts keep their natural order
    const rankedNumbers = [...numbers].sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.number - b.number
    );

    // 4. Replay each session's standings to see which cards actually won.
    const index = await cardIndexPromise;
    const tally = new Map<string, CardTally>();
    const prizeTotals = {} as Record<PrizeKey, number>;
    for (const key of PRIZE_ORDER) prizeTotals[key] = 0;

    for (const session of chosen) {
      const sessionRowsForGame = bySession.get(String(session.id));
      if (!sessionRowsForGame || sessionRowsForGame.length === 0) continue;

      const standings = computeStandings(
        index,
        orderMap(sessionRowsForGame),
        normalizePrizes(session.prizes)
      );

      for (const key of PRIZE_ORDER) {
        for (const winner of standings[key].winners) {
          prizeTotals[key]++;

          const id = `${winner.setNo}:${winner.cardNo}`;
          let entry = tally.get(id);
          if (!entry) {
            entry = {
              setNo: winner.setNo,
              cardNo: winner.cardNo,
              wins: 0,
              byPrize: { row1: 0, row2: 0, row3: 0, corners: 0, fullCard: 0 },
              sessions: new Set<string>(),
            };
            tally.set(id, entry);
          }
          entry.wins++;
          entry.byPrize[key]++;
          entry.sessions.add(String(session.id));
        }
      }
    }

    const cards = [...tally.values()]
      .map((c) => ({
        setNo: c.setNo,
        cardNo: c.cardNo,
        wins: c.wins,
        byPrize: c.byPrize,
        sessions: c.sessions.size,
      }))
      .sort((a, b) =>
        b.wins !== a.wins
          ? b.wins - a.wins
          : a.setNo !== b.setNo
          ? a.setNo - b.setNo
          : a.cardNo - b.cardNo
      );

    return NextResponse.json({
      success: true,
      clubName: user.clubName,
      /** the list the filter is built from — always every session, not just the chosen one */
      sessions: allSessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startedAt: s.started_at,
      })),
      sessionsCount: chosen.length,
      drawsCount: rows.length,
      numbers: rankedNumbers,
      cards,
      prizeTotals,
      prizeLabels: PRIZE_LABELS,
      cappedAt: allSessions.length >= MAX_SESSIONS ? MAX_SESSIONS : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء إعداد التقارير: ' + error.message },
      { status: 500 }
    );
  }
}
