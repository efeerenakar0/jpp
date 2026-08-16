import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';
import { abortApifyRun } from '@/lib/hunting-v2/worker-dispatch';
import { cancelHuntJobReservation } from '@/lib/hunting-v2/job-service';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]/cancel'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      throw new Error('Avci taramasini yalniz patron durdurabilir.');
    }
    const { id } = await context.params;
    enforceHuntingRateLimit(
      `job-control:${principal.account.id}:${principalActor(principal).key}`,
      { limit: 20, windowMs: 60_000 }
    );
    const job = await prisma.huntJob.findFirst({
      where: {
        id,
        companyAccountId: principal.account.id,
        status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] },
      },
      select: { id: true, apifyRunId: true, searchCacheId: true },
    });
    if (!job) throw new Error('Durdurulabilir av isi bulunamadi.');
    if (job.apifyRunId && job.searchCacheId) {
      const otherConsumers = await prisma.huntJob.count({
        where: {
          searchCacheId: job.searchCacheId,
          id: { not: job.id },
          status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] },
        },
      });
      if (!otherConsumers) await abortApifyRun(job.apifyRunId);
    }
    await cancelHuntJobReservation(job.id);
    return NextResponse.json({ jobId: id, status: 'CANCELLED' });
  } catch (error) {
    return huntingApiError(error);
  }
}
