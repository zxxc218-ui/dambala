import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(req: NextRequest) {
  try {
    const { status } = await req.json();

    if (!status || !['active', 'paused', 'finished'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'حالة الجلسة المطلوبة غير صالحة' },
        { status: 400 }
      );
    }

    // Find the current active or paused session in Supabase
    const { data: currentSession, error: fetchErr } = await supabase
      .from('draw_sessions')
      .select('id')
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!currentSession) {
      return NextResponse.json(
        { success: false, message: 'لا توجد جلسة لعب جارية حالياً لتحديث حالتها' },
        { status: 404 }
      );
    }

    const updateData: any = { status };
    if (status === 'finished') {
      updateData.ended_at = new Date().toISOString();
    }

    const { data: updatedSession, error: updateErr } = await supabase
      .from('draw_sessions')
      .update(updateData)
      .eq('id', currentSession.id)
      .select()
      .single();

    if (updateErr || !updatedSession) throw updateErr || new Error('فشل تحديث الجلسة في Supabase');

    let message = 'تم تحديث حالة الجلسة بنجاح';
    if (status === 'active') message = 'تم استئناف اللعب';
    if (status === 'paused') message = 'تم إيقاف اللعب مؤقتاً';
    if (status === 'finished') message = 'تم إنهاء الجلسة بنجاح';

    const formattedSession = {
      id: updatedSession.id,
      name: updatedSession.name,
      status: updatedSession.status,
      startedAt: updatedSession.started_at,
      endedAt: updatedSession.ended_at
    };

    return NextResponse.json({
      success: true,
      message,
      session: formattedSession
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء تحديث حالة الجلسة في Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
