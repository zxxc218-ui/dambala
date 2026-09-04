import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSession } from '@/lib/auth';
import { clearSessionCache } from '@/lib/sessions';

// GET: Fetch all sessions
export async function GET(req: NextRequest) {
  try {
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    let listQuery = supabase
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

    listQuery =
      user.clubId === null ? listQuery.is('club_id', null) : listQuery.eq('club_id', user.clubId);

    const { data: dbSessions, error } = await listQuery;

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
    const user = getUserSession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
        { status: 401 }
      );
    }

    const { name } = await req.json();
    const sessionName = name || `جلسة سحب دمبلة - ${new Date().toLocaleString('ar-EG')}`;

    // 1. Finish only THIS club's earlier sessions — another club's live game
    //    must not be ended by someone else starting theirs.
    let finishQuery = supabase
      .from('draw_sessions')
      .update({ status: 'finished', ended_at: new Date().toISOString() })
      .in('status', ['active', 'paused']);

    finishQuery =
      user.clubId === null ? finishQuery.is('club_id', null) : finishQuery.eq('club_id', user.clubId);

    const { error: updateErr } = await finishQuery;

    if (updateErr) throw updateErr;

    // 2. Create the new session in Supabase
    const { data: newSession, error: createErr } = await supabase
      .from('draw_sessions')
      .insert({
        name: sessionName,
        status: 'active',
        club_id: user.clubId
      })
      .select()
      .single();

    if (createErr || !newSession) throw createErr || new Error('فشل بدء الجلسة في Supabase');

    clearSessionCache(user);

    // `numbers` must be present (and empty) — the play screen reads it straight
    // away, and leaving it off made the page crash the moment a session started.
    const formattedSession = {
      id: newSession.id,
      name: newSession.name,
      startedAt: newSession.started_at,
      endedAt: newSession.ended_at,
      status: newSession.status,
      numbers: [] as { number: number; drawOrder: number }[]
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
