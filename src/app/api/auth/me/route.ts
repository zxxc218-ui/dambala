import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authenticated = isAdmin(req);
  return NextResponse.json({ authenticated });
}
