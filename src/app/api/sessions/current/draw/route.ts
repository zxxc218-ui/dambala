import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasRole } from '@/lib/auth';
import { getCardIndex, winsCompletedBy, WIN_LABELS } from '@/lib/cards';

export async function POST(req: NextRequest) {
  try {
    if (!hasRole(req, ['admin', 'caller'])) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    // Read the request body and warm the card index while the session query runs.
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // JSON body is optional (random draw)
    }

    const cardIndexPromise = getCardIndex();

    // 1. Fetch current active session
    const { data: session, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        status,
        draw_numbers ( number, draw_order )
      `)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
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

    const previousDraws = session.draw_numbers || [];
    const drawnBefore = new Set<number>(previousDraws.map((n: any) => n.number));

    // 2. Pick the number — manual if one was sent, otherwise random from what's left
    let drawnNumber: number;
    const manualNumberRaw = body.number;

    if (manualNumberRaw !== undefined && manualNumberRaw !== null && manualNumberRaw !== '') {
      const manualNum = parseInt(manualNumberRaw, 10);
      if (isNaN(manualNum) || manualNum < 1 || manualNum > 90) {
        return NextResponse.json(
          { success: false, message: 'يرجى إدخال رقم صالح بين 1 و 90' },
          { status: 400 }
        );
      }

      if (drawnBefore.has(manualNum)) {
        return NextResponse.json(
          { success: false, message: 'هذا الرقم مسحوب مسبقاً' },
          { status: 400 }
        );
      }

      drawnNumber = manualNum;
    } else {
      if (drawnBefore.size >= 90) {
        return NextResponse.json({
          success: false,
          message: 'تم سحب جميع الأرقام الـ 90 بالفعل!',
        });
      }

      const pool: number[] = [];
      for (let i = 1; i <= 90; i++) {
        if (!drawnBefore.has(i)) pool.push(i);
      }
      drawnNumber = pool[Math.floor(Math.random() * pool.length)];
    }

    // Derive the order from the highest one already stored rather than the row
    // count, so undoing a number and drawing again cannot reuse an order.
    const highestOrder = previousDraws.reduce(
      (max: number, n: any) => (n.draw_order > max ? n.draw_order : max),
      0
    );
    const nextOrder = highestOrder + 1;

    // 3. Save the draw
    const { error: insertErr } = await supabase
      .from('draw_numbers')
      .insert({ session_id: session.id, number: drawnNumber, draw_order: nextOrder });

    if (insertErr) throw insertErr;

    // 4. Scan for new winners.
    //    Only cards that actually contain the new number can have just won, so we
    //    look at those (~150) instead of re-scanning all 900 cards, and we read
    //    them from the cached index instead of hitting Supabase again.
    const index = await cardIndexPromise;
    const candidates = index.byNumber.get(drawnNumber) || [];

    const newWinners: { setNo: number; cardNo: number; winType: string }[] = [];
    for (const cardIdx of candidates) {
      const card = index.cards[cardIdx];
      for (const win of winsCompletedBy(card, drawnNumber, drawnBefore)) {
        newWinners.push({ setNo: card.setNo, cardNo: card.cardNo, winType: WIN_LABELS[win] });
      }
    }

    return NextResponse.json({
      success: true,
      number: drawnNumber,
      order: nextOrder,
      sessionName: session.name,
      newWinners,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء سحب الرقم من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Undo the most recent draw — for when the caller types the wrong number.
 * Removes only the last one, so it can be pressed repeatedly to walk back.
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!hasRole(req, ['admin', 'caller'])) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    const { data: session, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select('id, status')
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة نشطة حالياً' },
        { status: 400 }
      );
    }

    // The caller may name the number to remove. That is what the play screen
    // does, so the row that comes off is exactly the one shown on the button —
    // relying on "highest draw_order" alone can pick the wrong row when two
    // numbers were entered in quick succession and share an order.
    let requestedNumber: number | null = null;
    try {
      const body = await req.json();
      const parsed = parseInt(body?.number, 10);
      if (!isNaN(parsed)) requestedNumber = parsed;
    } catch {
      // no body — fall back to removing the most recent row
    }

    let query = supabase
      .from('draw_numbers')
      .select('id, number, draw_order')
      .eq('session_id', session.id);

    if (requestedNumber !== null) query = query.eq('number', requestedNumber);

    const { data: last, error: lastErr } = await query
      .order('draw_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw lastErr;

    if (!last) {
      return NextResponse.json(
        {
          success: false,
          message:
            requestedNumber !== null
              ? `الرقم ${requestedNumber} غير موجود ضمن الأرقام المسحوبة`
              : 'لا يوجد رقم مسحوب لإلغائه',
        },
        { status: 400 }
      );
    }

    // `.select()` makes the delete report which rows it actually removed.
    // Without it Supabase answers "no error" even when a row-level-security
    // policy silently blocked the delete — which looked like a successful
    // cancel while the number stayed in the table.
    const { data: deleted, error: deleteErr } = await supabase
      .from('draw_numbers')
      .delete()
      .eq('id', last.id)
      .select('id, number');

    if (deleteErr) throw deleteErr;

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            `لم يتم حذف الرقم ${last.number} من قاعدة البيانات. ` +
            'قاعدة البيانات ترفض الحذف — يرجى السماح بالحذف (DELETE) لجدول draw_numbers في إعدادات Supabase.',
          code: 'delete_blocked',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      removedNumber: last.number,
      message: `تم إلغاء الرقم ${last.number}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء إلغاء الرقم: ' + error.message },
      { status: 500 }
    );
  }
}
