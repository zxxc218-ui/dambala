import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession } from '@/lib/auth';
import { getActiveSession } from '@/lib/sessions';
import { getCardIndex, winsCompletedBy, WIN_LABELS } from '@/lib/cards';

function unauthorized() {
  return NextResponse.json(
    { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) return unauthorized();

    // Read the body and warm the card index while the session lookup runs.
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // no body — random draw
    }

    const cardIndexPromise = getCardIndex();

    const { session, error: sessionErr } = await getActiveSession(user, ['active']);
    if (sessionErr) throw sessionErr;

    if (!session) {
      const { session: paused } = await getActiveSession(user, ['paused']);
      if (paused) {
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

    // Only this session's numbers — a small, indexed read rather than the whole
    // session row with everything joined onto it.
    const { data: drawnRows, error: drawnErr } = await supabase
      .from('draw_numbers')
      .select('number, draw_order')
      .eq('session_id', session.id);

    if (drawnErr) throw drawnErr;

    const drawnBefore = new Set<number>((drawnRows || []).map((r: any) => r.number));

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
      for (let i = 1; i <= 90; i++) if (!drawnBefore.has(i)) pool.push(i);
      drawnNumber = pool[Math.floor(Math.random() * pool.length)];
    }

    const highestOrder = (drawnRows || []).reduce(
      (max: number, n: any) => (n.draw_order > max ? n.draw_order : max),
      0
    );
    const nextOrder = highestOrder + 1;

    const { error: insertErr } = await supabase
      .from('draw_numbers')
      .insert({ session_id: session.id, number: drawnNumber, draw_order: nextOrder });

    if (insertErr) throw insertErr;

    // Only cards holding the new number can have just won.
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
      { success: false, message: 'حدث خطأ أثناء سحب الرقم: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Undo a drawn number — for a wrong call.
 *
 * One database round trip: delete straight by (session, number) and let the
 * delete report what it removed. The previous version looked the session up,
 * then the row, then deleted it — three trips, about two seconds.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) return unauthorized();

    let requestedNumber: number | null = null;
    try {
      const body = await req.json();
      const parsed = parseInt(body?.number, 10);
      if (!isNaN(parsed)) requestedNumber = parsed;
    } catch {
      // no body — fall back to removing the most recent row
    }

    const { session, error: sessionErr } = await getActiveSession(user);
    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة نشطة حالياً' },
        { status: 400 }
      );
    }

    let removed: { number: number } | null = null;

    if (requestedNumber !== null) {
      // The fast path the play screen uses: it already knows the number.
      const { data, error } = await supabase
        .from('draw_numbers')
        .delete()
        .eq('session_id', session.id)
        .eq('number', requestedNumber)
        .select('number');

      if (error) throw error;

      if (!data || data.length === 0) {
        // Tell apart "not drawn" from "the database refused to delete".
        const { count } = await supabase
          .from('draw_numbers')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('number', requestedNumber);

        if ((count || 0) > 0) {
          return NextResponse.json(
            {
              success: false,
              code: 'delete_blocked',
              message:
                `لم يتم حذف الرقم ${requestedNumber} من قاعدة البيانات. ` +
                'قاعدة البيانات ترفض الحذف — يرجى السماح بالحذف (DELETE) لجدول draw_numbers في Supabase.',
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            message: `الرقم ${requestedNumber} غير موجود ضمن الأرقام المسحوبة`,
          },
          { status: 400 }
        );
      }

      removed = { number: data[0].number };
    } else {
      const { data: last, error: lastErr } = await supabase
        .from('draw_numbers')
        .select('id, number')
        .eq('session_id', session.id)
        .order('draw_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastErr) throw lastErr;

      if (!last) {
        return NextResponse.json(
          { success: false, message: 'لا يوجد رقم مسحوب لإلغائه' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('draw_numbers')
        .delete()
        .eq('id', last.id)
        .select('number');

      if (error) throw error;

      if (!data || data.length === 0) {
        return NextResponse.json(
          {
            success: false,
            code: 'delete_blocked',
            message:
              `لم يتم حذف الرقم ${last.number} من قاعدة البيانات. ` +
              'قاعدة البيانات ترفض الحذف — يرجى السماح بالحذف (DELETE) لجدول draw_numbers في Supabase.',
          },
          { status: 500 }
        );
      }

      removed = { number: data[0].number };
    }

    return NextResponse.json({
      success: true,
      removedNumber: removed.number,
      message: `تم إلغاء الرقم ${removed.number}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء إلغاء الرقم: ' + error.message },
      { status: 500 }
    );
  }
}
