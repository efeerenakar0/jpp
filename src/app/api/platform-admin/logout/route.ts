import { NextResponse } from 'next/server';
import { PLATFORM_ADMIN_SESSION_COOKIE } from '@/lib/platform-admin-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: PLATFORM_ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
