import { NextResponse } from 'next/server';
import {
  cleanupExpiredStudioBatches,
  processNextStudioBatchItem,
} from '@/lib/studio-batches';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get('authorization') === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Yetkisiz istek.' }, { status: 401 });
  }
  const startedAt = Date.now();
  const cleaned = await cleanupExpiredStudioBatches().catch(() => 0);
  const results: Awaited<ReturnType<typeof processNextStudioBatchItem>>[] = [];
  while (results.length < 3 && Date.now() - startedAt < 240_000) {
    const result = await processNextStudioBatchItem();
    if (!result) break;
    results.push(result);
  }
  return NextResponse.json({ success: true, processed: results.length, cleaned, results });
}
