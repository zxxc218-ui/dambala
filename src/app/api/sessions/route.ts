import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch all sessions
export async function GET(req: NextRequest) {
  try {
    const { data: dbSessions, error } = await supabase
      .from('draw_sessions')
      .select(`
        id,
        name,
        started_at,
        ended_at,
        status,
        draw_numbers (count)
      `)
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Map to SQLite consistent response
    const sessions = (dbSessions || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      status: s.status,
      _count: {
        numbers: s.draw_numbers?.[0]?.count || 0
      }
    }));

    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب الجلسات من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Start a new game session
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const sessionName = name || `جلسة سحب دمبلة - ${new Date().toLocaleString('ar-EG')}`;

    // 1. Finish all other active or paused sessions in Supabase
    const { error: updateErr } = await supabase
      .from('draw_sessions')
      .update({
        status: 'finished',
        ended_at: new Date().toISOString()
      })
      .in('status', ['active', 'paused']);

    if (updateErr) throw updateErr;

    // 2. Create the new session in Supabase
    const { data: newSession, error: createErr } = await supabase
      .from('draw_sessions')
      .insert({
        name: sessionName,
        status: 'active'
      })
      .select()
      .single();

    if (createErr || !newSession) throw createErr || new Error('فشل بدء الجلسة في Supabase');

    const formattedSession = {
      id: newSession.id,
      name: newSession.name,
      startedAt: newSession.started_at,
      endedAt: newSession.ended_at,
      status: newSession.status
    };

    return NextResponse.json({
      success: true,
      message: 'تم بدء جلسة سحب جديدة بنجاح في Supabase',
      session: formattedSession
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء بدء الجلسة في Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
