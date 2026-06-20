import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { USER_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      );
    }

    // Query profiles table in Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, password, role')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'جدول المستخدمين غير موجود في قاعدة البيانات. يرجى تهيئة جداول الأدوار في Supabase وتشغيل سكربت الـ SQL.',
            isSchemaMissing: true
          },
          { status: 500 }
        );
      }
      throw error;
    }

    if (!profile || profile.password !== password) {
      return NextResponse.json(
        { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const userSession = {
      username: profile.username,
      role: profile.role
    };

    const cookieValue = Buffer.from(JSON.stringify(userSession)).toString('base64');
    const response = NextResponse.json({ 
      success: true, 
      message: 'تم تسجيل الدخول بنجاح',
      user: userSession
    });

    response.cookies.set(USER_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء معالجة تسجيل الدخول: ' + error.message },
      { status: 500 }
    );
  }
}
