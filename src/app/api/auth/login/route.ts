import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  USER_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
  UserProfile,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('id, username, password_hash, role, club_name, active')
      .eq('username', String(username).trim().toLowerCase())
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          {
            success: false,
            message: 'جدول المستخدمين غير موجود بعد. افتح صفحة /setup لتهيئة النظام.',
            needsSetup: true,
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // Same answer whether the user is missing, disabled, or the password is
    // wrong — so the form cannot be used to discover which usernames exist.
    const ok = user && user.active && (await verifyPassword(password, user.password_hash));

    if (!ok) {
      return NextResponse.json(
        { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const profile: UserProfile = {
      username: user.username,
      role: user.role === 'super_admin' ? 'super_admin' : 'club',
      clubId: user.role === 'super_admin' ? null : user.id,
      clubName: user.club_name ?? null,
    };

    const response = NextResponse.json({ success: true, user: profile });
    response.cookies.set(USER_COOKIE_NAME, createSessionToken(profile), sessionCookieOptions);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء تسجيل الدخول: ' + error.message },
      { status: 500 }
    );
  }
}
