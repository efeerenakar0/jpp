import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';
import { synchronizeClearpathJob } from '@/lib/hunting-v2/clearpath-ingest';
import { huntingQuotaPolicy } from '@/lib/hunting-v2/clearpath-contract';
import type { HuntPropertyType } from '@/lib/hunting-v2/property-types';

export const runtime = 'nodejs';

const selectJob = {
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
  propertyType: true,
  requestedResults: true,
  quotaPeriodStart: true,
  quotaReserved: true,
  apifyRunId: true,
  apifyDatasetId: true,
  apifyStatus: true,
  dispatchStrategy: true,
  cacheHit: true,
  ingestedAt: true,
} as const;

export async function GET(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      throw new Error('Avci is durumunu yalniz patron goruntuleyebilir.');
    }
    const { id } = await context.params;
    let job = await prisma.huntJob.findFirst({
      where: { id, companyAccountId: principal.account.id },
      select: selectJob,
    });
    if (!job) throw new Error('Av isi bulunamadi.');
    if (
      !job.ingestedAt &&
      ['QUEUED', 'RUNNING'].includes(job.status)
    ) {
      await synchronizeClearpathJob(job.id).catch(() => undefined);
      job = await prisma.huntJob.findFirst({
        where: { id, companyAccountId: principal.account.id },
        select: selectJob,
      });
    }
    if (!job) throw new Error('Av isi bulunamadi.');
    const policy = job.propertyType
      ? huntingQuotaPolicy(job.propertyType as HuntPropertyType)
      : null;
    const quotaRow =
      job.propertyType && job.quotaPeriodStart
        ? await prisma.huntingMonthlyQuota.findUnique({
            where: {
              companyAccountId_propertyType_periodStart: {
                companyAccountId: principal.account.id,
                propertyType: job.propertyType,
                periodStart: job.quotaPeriodStart,
              },
            },
          })
        : null;
    return NextResponse.json({
      ...job,
      quota:
        policy && quotaRow
          ? {
              ...policy,
              used: quotaRow.used,
              reserved: quotaRow.reserved,
              remaining: Math.max(
                0,
                policy.monthlyLimit - quotaRow.used - quotaRow.reserved
              ),
              periodStart: quotaRow.periodStart,
              periodEnd: quotaRow.periodEnd,
            }
          : null,
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
