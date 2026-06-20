import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. Fetch current active session from Supabase
    const { data: session, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        status,
        draw_numbers (
          number,
          draw_order
        )
      `)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      // Check if paused session exists instead
      const { data: pausedSession } = await supabase
        .from('draw_sessions')
        .select('id')
        .eq('status', 'paused')
        .maybeSingle();

      if (pausedSession) {
        return NextResponse.json(
          { success: false, message: 'الجلسة متوقفة مؤقتاً، يرجى استئناف اللعب أولاً' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة نشطة حالياً. يرجى بدء جلسة جديدة' },
        { status: 400 }
      );
    }

    const drawnNumbers = (session.draw_numbers || []).map((n: any) => n.number);
    const previouslyDrawnSet = new Set(drawnNumbers);

    let drawnNumber: number;

    // 2. Read manual number
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // JSON body optional
    }

    const manualNumberRaw = body.number;

    if (manualNumberRaw !== undefined && manualNumberRaw !== null && manualNumberRaw !== '') {
      const manualNum = parseInt(manualNumberRaw, 10);
      if (isNaN(manualNum) || manualNum < 1 || manualNum > 90) {
        return NextResponse.json(
          { success: false, message: 'يرجى إدخال رقم صالح بين 1 و 90' },
          { status: 400 }
        );
      }

      if (previouslyDrawnSet.has(manualNum)) {
        return NextResponse.json(
          { success: false, message: 'هذا الرقم مسحوب مسبقاً' },
          { status: 400 }
        );
      }

      drawnNumber = manualNum;
    } else {
      // Draw random
      if (drawnNumbers.length >= 90) {
        return NextResponse.json({
          success: false,
          message: 'تم سحب جميع الأرقام الـ 90 بالفعل!'
        });
      }

      const pool: number[] = [];
      for (let i = 1; i <= 90; i++) {
        if (!previouslyDrawnSet.has(i)) {
          pool.push(i);
        }
      }

      const randomIndex = Math.floor(Math.random() * pool.length);
      drawnNumber = pool[randomIndex];
    }

    const nextOrder = (session.draw_numbers || []).length + 1;

    // 3. Save to database in Supabase
    const { error: insertErr } = await supabase
      .from('draw_numbers')
      .insert({
        session_id: session.id,
        number: drawnNumber,
        draw_order: nextOrder
      });

    if (insertErr) throw insertErr;

    // 4. SCAN FOR NEW WINNERS
    const newWinners: { setNo: number; cardNo: number; winType: string }[] = [];

    // Fetch all cards and their rows from Supabase
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

    for (const card of (dbCards || [])) {
      // Resolve set number dynamically depending on structure returned by Supabase
      const setNoVal = (card as any).sets?.set_no ?? (card as any).sets?.[0]?.set_no ?? 0;
      const rows = card.card_rows || [];

      // Check Row 1
      const r1 = rows.find((r: any) => r.row_no === 1);
      if (r1 && checkRowWin(r1, drawnNumber, previouslyDrawnSet)) {
        newWinners.push({ setNo: setNoVal, cardNo: card.card_no, winType: 'الخط الأول' });
      }

      // Check Row 2
      const r2 = rows.find((r: any) => r.row_no === 2);
      if (r2 && checkRowWin(r2, drawnNumber, previouslyDrawnSet)) {
        newWinners.push({ setNo: setNoVal, cardNo: card.card_no, winType: 'الخط الثاني' });
      }

      // Check Row 3
      const r3 = rows.find((r: any) => r.row_no === 3);
      if (r3 && checkRowWin(r3, drawnNumber, previouslyDrawnSet)) {
        newWinners.push({ setNo: setNoVal, cardNo: card.card_no, winType: 'الخط الثالث' });
      }

      // Check Full Card
      if (checkCardWin(rows, drawnNumber, previouslyDrawnSet)) {
        newWinners.push({ setNo: setNoVal, cardNo: card.card_no, winType: 'البطاقة كاملة (دمبلة)' });
      }
    }

    return NextResponse.json({
      success: true,
      number: drawnNumber,
      order: nextOrder,
      sessionName: session.name,
      newWinners
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء سحب الرقم من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

function checkRowWin(row: any, newNum: number, drawnSet: Set<number>): boolean {
  const vals = [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].filter(v => v !== null) as number[];
  if (vals.length === 0) return false;
  if (!vals.includes(newNum)) return false;
  return vals.every(v => v === newNum || drawnSet.has(v));
}

function checkCardWin(cardRows: any[], newNum: number, drawnSet: Set<number>): boolean {
  const vals: number[] = [];
  cardRows.forEach(row => {
    [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].forEach(v => {
      if (v !== null) vals.push(v as number);
    });
  });
  if (vals.length === 0) return false;
  if (!vals.includes(newNum)) return false;
  return vals.every(v => v === newNum || drawnSet.has(v));
}
