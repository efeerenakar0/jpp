import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { createHuntJob } from '@/lib/hunting-v2/job-service';
import { huntingQuotaPolicy } from '@/lib/hunting-v2/clearpath-contract';
import type { HuntPropertyType } from '@/lib/hunting-v2/property-types';
import prisma from '@/lib/prisma';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      throw new Error('Avci taramasini yalniz patron baslatabilir.');
    }
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `job:${principal.account.id}:${actor.key}`,
      { limit: 5, windowMs: 60_000 }
    );
    const job = await createHuntJob({
      companyAccountId: principal.account.id,
      createdBy: actor.key,
      body: await request.json(),
    });
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
    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        propertyType: job.propertyType,
        requestedResults: job.requestedResults,
        strategy: {
          cacheHit: job.cacheHit,
          requestedResults: job.requestedResults,
          dispatchStrategy: job.dispatchStrategy,
        },
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
      },
      {
        status: job.status === 'QUEUED' ? 202 : 200,
        headers: { Location: `/api/fabrika/hunting/jobs/${job.id}` },
      }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
