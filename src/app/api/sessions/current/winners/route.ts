import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardIndex, winsForCard } from '@/lib/cards';

export async function GET(req: NextRequest) {
  try {
    const cardIndexPromise = getCardIndex();

    // 1. Find the active or paused session
    const { data: session, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        draw_numbers ( number )
      `)
      .in('status', ['active', 'paused'])
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
