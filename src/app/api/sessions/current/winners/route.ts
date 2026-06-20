import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // 1. Find active or paused session in Supabase
    const { data: session, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        draw_numbers (
          number
        )
      `)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد جلسة لعب نشطة حالياً لفحص الفائزين',
        winners: []
      });
    }

    const drawnNumbers = (session.draw_numbers || []).map((n: any) => n.number);
    const drawnSet = new Set(drawnNumbers);

    // 2. Fetch all cards and their rows from Supabase
    const { data: dbCards, error: cardsErr } = await supabase
      .from('cards')
      .select(`
        id,
        card_no,
        sets (
          set_no
        ),
        card_rows (
          row_no,
          c1, c2, c3, c4, c5, c6, c7, c8, c9
        )
      `);

    if (cardsErr) throw cardsErr;

    const winners: {
      setNo: number;
      cardNo: number;
      row1: boolean;
      row2: boolean;
      row3: boolean;
      fullCard: boolean;
    }[] = [];

    // Sort cards by set_no and card_no manually
    const cards = dbCards || [];
    cards.sort((a: any, b: any) => {
      const setA = (a as any).sets?.set_no ?? (a as any).sets?.[0]?.set_no ?? 0;
      const setB = (b as any).sets?.set_no ?? (b as any).sets?.[0]?.set_no ?? 0;
      if (setA !== setB) return setA - setB;
      return a.card_no - b.card_no;
    });

    // 3. Scan cards for wins
    for (const card of cards) {
      const setNoVal = (card as any).sets?.set_no ?? (card as any).sets?.[0]?.set_no ?? 0;
      const rows = card.card_rows || [];

      const r1 = rows.find((r: any) => r.row_no === 1);
      const r2 = rows.find((r: any) => r.row_no === 2);
      const r3 = rows.find((r: any) => r.row_no === 3);

      const row1 = r1 ? isRowComplete(r1, drawnSet) : false;
      const row2 = r2 ? isRowComplete(r2, drawnSet) : false;
      const row3 = r3 ? isRowComplete(r3, drawnSet) : false;
      const fullCard = isCardComplete(rows, drawnSet);

      if (row1 || row2 || row3 || fullCard) {
        winners.push({
          setNo: setNoVal,
          cardNo: card.card_no,
          row1,
          row2,
          row3,
          fullCard
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessionName: session.name,
      drawnCount: drawnNumbers.length,
      winners
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء فحص الفائزين من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

function isRowComplete(row: any, drawnSet: Set<number>): boolean {
  const vals = [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].filter(v => v !== null) as number[];
  if (vals.length === 0) return false;
  return vals.every(v => drawnSet.has(v));
}

function isCardComplete(cardRows: any[], drawnSet: Set<number>): boolean {
  const vals: number[] = [];
  cardRows.forEach(row => {
    [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].forEach(v => {
      if (v !== null) vals.push(v as number);
    });
  });
  if (vals.length === 0) return false;
  return vals.every(v => drawnSet.has(v));
}
