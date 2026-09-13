import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession, UserProfile } from '@/lib/auth';
import { isMissingPrizesColumn, normalizePrizes } from '@/lib/prizes';

/**
 * One past game, exactly as it was played.
 *
 * The numbers come back in the order they were drawn and the prize rules come
 * back with them, because who won is decided by both — the same fifteen numbers
 * on a card win nothing if the line was already taken, and that depends on the
 * order and on how many winners that prize allowed on the night.
 *
 * The winners themselves are not stored and never were. They are worked out
 * from this one session's numbers, on whatever screen is asking, which is what
 * makes the answer for a session belong to that session and no other: there is
 * no shared list to leak from.
 */

function scoped(query: any, user: UserProfile) {
  return user.clubId === null ? query.is('club_id', null) : query.eq('club_id', user.clubId);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ success: false, message: 'رقم جلسة غير صالح' }, { status: 400 });
    }

    const read = (columns: string) =>
      scoped(supabase.from('draw_sessions').select(columns).eq('id', sessionId), user).maybeSingle();

    const WITH_PRIZES =
      'id, name, status, started_at, ended_at, prizes, draw_numbers ( number, draw_order )';
    const WITHOUT_PRIZES =
      'id, name, status, started_at, ended_at, draw_numbers ( number, draw_order )';

    let { data, error } = (await read(WITH_PRIZES)) as any;
    if (error && isMissingPrizesColumn(error)) {
      ({ data, error } = (await read(WITHOUT_PRIZES)) as any);
    }
    if (error) throw error;

    // A club asking for another club's session is told the same thing as one
    // asking for a session that does not exist.
    if (!data) {
      return NextResponse.json({ success: false, message: 'الجلسة غير موجودة' }, { status: 404 });
    }

    const numbers = (data.draw_numbers || [])
      .map((n: any) => ({ number: n.number, drawOrder: n.draw_order }))
      .sort((a: any, b: any) => a.drawOrder - b.drawOrder);

    return NextResponse.json({
      success: true,
      session: {
        id: data.id,
        name: data.name,
        status: data.status,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        numbers,
        prizes: normalizePrizes(data.prizes),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذر جلب الجلسة: ' + error.message },
      { status: 500 }
    );
  }
}
