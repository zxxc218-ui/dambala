import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getUserSession(req);
  return NextResponse.json({
    authenticated: !!session,
    user: session
  });
}
