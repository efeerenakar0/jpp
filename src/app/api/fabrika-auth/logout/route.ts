import { NextResponse } from 'next/server';
import { FABRIKA_SESSION_COOKIE } from '@/lib/fabrika-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: FABRIKA_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
    path: '/',
  });

  return response;
}
