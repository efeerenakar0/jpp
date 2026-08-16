import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { synchronizeClearpathJob } from '@/lib/hunting-v2/clearpath-ingest';
import { recoverQueuedClearpathDispatches } from '@/lib/hunting-v2/job-service';

export const runtime = 'nodejs';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && request.headers.get('authorization') === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Yetkisiz cron isteği.' }, { status: 401 });
  }

  const dispatchRecovery = await recoverQueuedClearpathDispatches();

  const jobs = await prisma.huntJob.findMany({
    where: {
      status: { in: ['QUEUED', 'RUNNING'] },
      ingestedAt: null,
      searchCacheId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: 50,
  });

  let completed = 0;
  let failed = 0;
  let pending = 0;
  for (const job of jobs) {
    try {
      const result = await synchronizeClearpathJob(job.id);
      if (result.status === 'completed') completed += 1;
      else if (result.status === 'failed') failed += 1;
      else pending += 1;
    } catch {
      // A single provider/network failure must not stop the other tenants.
      pending += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: jobs.length,
    completed,
    failed,
    pending,
    dispatchRecovery,
  });
}
