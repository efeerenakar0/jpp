import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { id } = await context.params;
    const job = await prisma.huntJob.findFirst({
      where: { id, companyAccountId: principal.account.id },
      select: {
        id: true,
        provider: true,
        searchUrl: true,
        status: true,
        totalDiscovered: true,
        totalCompleted: true,
        totalPartial: true,
        totalFailed: true,
        errorSummary: true,
        startedAt: true,
        pausedAt: true,
        completedAt: true,
        lastHeartbeatAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!job) throw new Error('Av işi bulunamadı.');
    return NextResponse.json(job);
  } catch (error) {
    return huntingApiError(error);
  }
}
