import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { data: dbSession, error } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        status,
        started_at,
        ended_at,
        draw_numbers (
          number,
          draw_order
        )
      `)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (error) throw error;

    if (!dbSession) {
      return NextResponse.json({ success: true, session: null });
    }

    // Format numbers sorted by draw_order
    const numbers = (dbSession.draw_numbers || []).map((n: any) => ({
      number: n.number,
      drawOrder: n.draw_order
    }));
    numbers.sort((a: any, b: any) => a.drawOrder - b.drawOrder);

    const formattedSession = {
      id: dbSession.id,
      name: dbSession.name,
      status: dbSession.status,
      startedAt: dbSession.started_at,
      endedAt: dbSession.ended_at,
      numbers
    };

    return NextResponse.json({ success: true, session: formattedSession });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب الجلسة الحالية من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
