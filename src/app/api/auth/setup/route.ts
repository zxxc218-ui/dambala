import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, hasServiceRole } from '@/lib/supabase';
import {
  USER_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
  hashPassword,
  passwordProblem,
  usernameProblem,
  UserProfile,
} from '@/lib/auth';

/**
 * First-run setup for the super admin account.
 *
 * The password is typed by the owner in their own browser and only ever leaves
 * as a hash — it is never written into the source, a message, or a log.
 * Once a super admin exists this route refuses, so it cannot be used to take
 * the system over later.
 */

async function superAdminExists() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1);

  if (error) return { error };
  return { exists: (data || []).length > 0 };
}

/**
 * Supabase reports a missing table two different ways depending on whether the
 * request reached Postgres or stopped at PostgREST's schema cache.
 */
function isTableMissing(error: any): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /could not find the table/i.test(error?.message || '')
  );
}

export async function GET() {
  const check = await superAdminExists();

  if (check.error) {
    const tableMissing = isTableMissing(check.error);
    return NextResponse.json({
      success: false,
      tableMissing,
      hasServiceRole,
      message: tableMissing
        ? 'جدول المستخدمين غير موجود. شغّل سكربت db/users.sql في Supabase أولاً.'
        : 'تعذر قراءة جدول المستخدمين: ' + (check.error as any).message,
    });
  }

  return NextResponse.json({
    success: true,
    alreadySetUp: check.exists,
    hasServiceRole,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const uProblem = usernameProblem(username);
    if (uProblem) return NextResponse.json({ success: false, message: uProblem }, { status: 400 });

    const pProblem = passwordProblem(password);
    if (pProblem) return NextResponse.json({ success: false, message: pProblem }, { status: 400 });

    const check = await superAdminExists();
    if (check.error) throw check.error;

    if (check.exists) {
      return NextResponse.json(
        {
          success: false,
          message: 'تم إعداد النظام مسبقاً. لإنشاء مستخدمين جدد سجّل دخول كسوبر أدمن.',
        },
        { status: 409 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    const { data: created, error } = await supabaseAdmin
      .from('app_users')
      .insert({
        username: cleanUsername,
        password_hash: await hashPassword(password),
        role: 'super_admin',
        club_name: null,
        active: true,
      })
      .select('id, username, role, club_name')
      .single();

    if (error) throw error;

    const profile: UserProfile = {
      username: created.username,
      role: 'super_admin',
      clubId: null,
      clubName: null,
    };

    const response = NextResponse.json({
      success: true,
      message: 'تم إنشاء حساب السوبر أدمن بنجاح',
      user: profile,
    });
    response.cookies.set(USER_COOKIE_NAME, createSessionToken(profile), sessionCookieOptions);
    return response;
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { success: false, message: 'اسم المستخدم محجوز، اختر اسماً آخر' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء إنشاء الحساب: ' + error.message },
      { status: 500 }
    );
  }
}
