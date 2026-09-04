import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession } from '@/lib/auth';
import { getCardIndex, winsForCard } from '@/lib/cards';

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
    let sessionQuery = supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        draw_numbers ( number )
      `)
      .in('status', ['active', 'paused']);

    sessionQuery =
      user.clubId === null ? sessionQuery.is('club_id', null) : sessionQuery.eq('club_id', user.clubId);

    const { data: session, error: sessionErr } = await sessionQuery
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد جلسة لعب نشطة حالياً لفحص الفائزين',
        winners: [],
      });
    }

    const drawnNumbers = (session.draw_numbers || []).map((n: any) => n.number);
    const drawnSet = new Set<number>(drawnNumbers);

    // 2. Scan the cached card index — no second trip to Supabase
    const index = await cardIndexPromise;

    const winners: {
      setNo: number;
      cardNo: number;
      row1: boolean;
      row2: boolean;
      row3: boolean;
      corners: boolean;
      fullCard: boolean;
    }[] = [];

    for (const card of index.cards) {
      const wins = winsForCard(card, drawnSet);
      if (wins.row1 || wins.row2 || wins.row3 || wins.corners || wins.fullCard) {
        winners.push({ setNo: card.setNo, cardNo: card.cardNo, ...wins });
      }
    }

    return NextResponse.json({
      success: true,
      sessionName: session.name,
      drawnCount: drawnNumbers.length,
      winners,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء فحص الفائزين من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
