import { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE_NAME, ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  
  response.cookies.set(USER_COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}
