import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession } from '@/lib/auth';
import { getActiveSession, clearSessionCache } from '@/lib/sessions';
import { getCardIndex } from '@/lib/cards';
import {
  computeStandings,
  isMissingPrizesColumn,
  normalizePrizes,
  orderMap,
  toStatus,
} from '@/lib/prizes';

/**
 * Change the prize rules of the running game.
 *
 * Handy when the caller starts a round and only then decides that الخط الأول
 * pays three times instead of one. Because no win is ever stored, raising or
 * lowering a count re-decides the standings immediately.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const prizes = normalizePrizes(body?.prizes);

    const { session, error: sessionErr } = await getActiveSession(user);
    if (sessionErr) throw sessionErr;

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة نشطة حالياً' },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from('draw_sessions')
      .update({ prizes })
      .eq('id', session.id);

    if (updateErr) {
      if (isMissingPrizesColumn(updateErr)) {
        return NextResponse.json(
          {
            success: false,
            code: 'needs_migration',
            message:
              'ما أكدر أحفظ إعدادات الجوائز: عمود prizes غير موجود بقاعدة البيانات. ' +
              'شغّل السكربت db/prizes.sql في Supabase → SQL Editor مرة وحدة وبعدها جرّب.',
          },
          { status: 500 }
        );
      }
      throw updateErr;
    }

    // the cached session row still holds the old rules
    clearSessionCache(user);

    // Hand back the recalculated counters so the screen updates in place.
    let prizeStatus = null;
    try {
      const { data: rows } = await supabase
        .from('draw_numbers')
        .select('number, draw_order')
        .eq('session_id', session.id);

      const index = await getCardIndex();
      prizeStatus = toStatus(computeStandings(index, orderMap((rows || []) as any), prizes));
    } catch {
      // counters are a nicety, not a reason to fail the save
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ إعدادات الجوائز',
      prizes,
      prizeStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء حفظ إعدادات الجوائز: ' + error.message },
      { status: 500 }
    );
  }
}
