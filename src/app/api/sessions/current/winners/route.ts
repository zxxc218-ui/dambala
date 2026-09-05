import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession, UserProfile } from '@/lib/auth';
import { getCardIndex, winsForCard } from '@/lib/cards';
import {
  PRIZE_ORDER,
  PrizeKey,
  computeStandings,
  isMissingPrizesColumn,
  normalizePrizes,
  orderMap,
  toStatus,
} from '@/lib/prizes';

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
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

    const cardIndexPromise = getCardIndex();

    // 1. Find this club's active or paused session
    const read = (columns: string) =>
      scoped(
        supabase.from('draw_sessions').select(columns).in('status', ['active', 'paused']),
        user
      )
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const WITH_PRIZES = 'id, name, prizes, draw_numbers ( number, draw_order )';
    const WITHOUT_PRIZES = 'id, name, draw_numbers ( number, draw_order )';

    let { data: session, error: sessionErr } = (await read(WITH_PRIZES)) as any;

    if (sessionErr && isMissingPrizesColumn(sessionErr)) {
      ({ data: session, error: sessionErr } = (await read(WITHOUT_PRIZES)) as any);
    }

    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد جلسة لعب نشطة حالياً لفحص الفائزين',
        winners: [],
        prizes: [],
      });
    }

    const rows = (session.draw_numbers || []) as { number: number; draw_order: number }[];
    const drawnSet = new Set<number>(rows.map((n) => n.number));
    const prizeSettings = normalizePrizes(session.prizes);

    // 2. Scan the cached card index — no second trip to Supabase
    const index = await cardIndexPromise;
    const standings = computeStandings(index, orderMap(rows), prizeSettings);

    /** cards that actually take each prize, for a quick lookup below */
    const awarded = new Map<PrizeKey, Set<string>>();
    for (const key of PRIZE_ORDER) {
      awarded.set(key, new Set(standings[key].winners.map((w) => `${w.setNo}:${w.cardNo}`)));
    }

    const winners: any[] = [];

    for (const card of index.cards) {
      const wins = winsForCard(card, drawnSet);
      if (!wins.row1 && !wins.row2 && !wins.row3 && !wins.corners && !wins.fullCard) continue;

      const id = `${card.setNo}:${card.cardNo}`;
      const takes: Record<string, boolean> = {};
      for (const key of PRIZE_ORDER) {
        takes[key] = wins[key] && (awarded.get(key)?.has(id) ?? false);
      }

      winners.push({
        setNo: card.setNo,
        cardNo: card.cardNo,
        ...wins,
        // completed the line but the prize was already full / switched off
        awarded: takes,
        paid: PRIZE_ORDER.some((key) => takes[key]),
      });
    }

    // The prize-winners first, then the cards that merely completed a line.
    winners.sort((a, b) => Number(b.paid) - Number(a.paid));

    return NextResponse.json({
      success: true,
      sessionName: session.name,
      drawnCount: rows.length,
      prizes: toStatus(standings),
      prizeBoard: PRIZE_ORDER.map((key) => ({
        key,
        label: standings[key].label,
        enabled: standings[key].enabled,
        unlimited: standings[key].unlimited,
        count: standings[key].count,
        winners: standings[key].winners,
      })),
      winners,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء فحص الفائزين من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
