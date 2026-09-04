import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  isSuperAdmin,
  hashPassword,
  passwordProblem,
  usernameProblem,
} from '@/lib/auth';

/** Club accounts. Only the super admin may look at or change this list. */

function forbidden() {
  return NextResponse.json(
    { success: false, message: 'هذي الصفحة للسوبر أدمن فقط' },
    { status: 403 }
  );
}

export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) return forbidden();

  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('id, username, role, club_name, active, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // password_hash is never selected, so it cannot leak through this route
    return NextResponse.json({ success: true, users: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذر جلب المستخدمين: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isSuperAdmin(req)) return forbidden();

  try {
    const { username, password, clubName } = await req.json();

    const uProblem = usernameProblem(username);
    if (uProblem) return NextResponse.json({ success: false, message: uProblem }, { status: 400 });

    const pProblem = passwordProblem(password);
    if (pProblem) return NextResponse.json({ success: false, message: pProblem }, { status: 400 });

    if (!clubName || String(clubName).trim().length < 2) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال اسم النادي' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .insert({
        username: String(username).trim().toLowerCase(),
        password_hash: await hashPassword(password),
        role: 'club',
        club_name: String(clubName).trim(),
        active: true,
      })
      .select('id, username, role, club_name, active, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `تم إنشاء حساب النادي "${data.club_name}"`,
      user: data,
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { success: false, message: 'اسم المستخدم محجوز، اختر اسماً آخر' },
        { status: 409 }
      );
    }
    if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) {
      return NextResponse.json(
        {
          success: false,
          message:
            'قاعدة البيانات ترفض الكتابة على جدول المستخدمين. أضف المفتاح SUPABASE_SERVICE_ROLE_KEY في Vercel ثم أعد النشر.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'تعذر إنشاء الحساب: ' + error.message },
      { status: 500 }
    );
  }
}
