import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Find current active or paused session in Supabase
    const { data: currentSession, error: fetchErr } = await supabase
      .from('draw_sessions')
      .select('id')
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!currentSession) {
      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة لعب جارية حالياً لإعادة ضبطها' },
        { status: 404 }
      );
    }

    // 1. Delete all drawn numbers for this session in Supabase
    const { error: deleteErr } = await supabase
      .from('draw_numbers')
      .delete()
      .eq('session_id', currentSession.id);

    if (deleteErr) throw deleteErr;

    // 2. Reset session metadata in Supabase
    const { data: resetSession, error: updateErr } = await supabase
      .from('draw_sessions')
      .update({
        started_at: new Date().toISOString(),
        status: 'active'
      })
      .eq('id', currentSession.id)
      .select()
      .single();

    if (updateErr || !resetSession) throw updateErr || new Error('فشل إعادة ضبط الجلسة في Supabase');

    const formattedSession = {
      id: resetSession.id,
      name: resetSession.name,
      status: resetSession.status,
      startedAt: resetSession.started_at
    };

    return NextResponse.json({
      success: true,
      message: 'تم إعادة ضبط الجلسة ومسح جميع الأرقام المسحوبة بنجاح',
      session: formattedSession
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء إعادة ضبط الجلسة في Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
