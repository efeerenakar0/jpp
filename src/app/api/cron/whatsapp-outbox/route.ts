import { NextResponse } from 'next/server';
import { drainWhatsAppOutbox } from '@/lib/company-whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get('authorization') !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: 'Yetkisiz cron isteği.' }, { status: 401 });
  }
  const results = await drainWhatsAppOutbox(25);
  return NextResponse.json({
    processed: results.length,
    sent: results.filter((item) => item?.status === 'SENT').length,
    queued: results.filter((item) => item?.status === 'QUEUED').length,
    failed: results.filter((item) => item?.status === 'FAILED').length,
  });
}
