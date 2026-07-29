import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]/cancel'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { id } = await context.params;
    enforceHuntingRateLimit(
      `job-control:${principal.account.id}:${principalActor(principal).key}`,
      { limit: 20, windowMs: 60_000 }
    );
    const result = await prisma.huntJob.updateMany({
      where: {
        id,
        companyAccountId: principal.account.id,
        status: {
          in: ['QUEUED', 'RUNNING', 'PAUSED', 'SOURCE_CHALLENGE'],
        },
      },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    if (!result.count) throw new Error('Durdurulabilir av işi bulunamadı.');
    return NextResponse.json({ jobId: id, status: 'CANCELLED' });
  } catch (error) {
    return huntingApiError(error);
  }
}
