import { NextResponse } from 'next/server';
import { syncCompanyGoogleCalendar } from '@/lib/google-calendar';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz cron isteği.' }, { status: 401 });
  }

  const connections = await prisma.googleCalendarConnection.findMany({
    orderBy: [{ lastSyncedAt: 'asc' }, { createdAt: 'asc' }],
    select: { companyAccountId: true },
    take: 10,
  });
  const results: Array<{
    companyAccountId: string;
    status: 'synced' | 'failed';
    error?: string;
  }> = [];

  for (const connection of connections) {
    try {
      await syncCompanyGoogleCalendar(connection.companyAccountId);
      results.push({
        companyAccountId: connection.companyAccountId,
        status: 'synced',
      });
    } catch (error) {
      results.push({
        companyAccountId: connection.companyAccountId,
        status: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Google Calendar senkronu tamamlanamadı.',
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
