import { NextResponse } from 'next/server';
import { processPartnerEmailOutbox } from '@/lib/partner-outreach/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const result = await processPartnerEmailOutbox({ limit: 10 });
  return NextResponse.json({ success: true, ...result });
}
