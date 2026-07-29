import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { createHuntJob } from '@/lib/hunting-v2/job-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
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
    return NextResponse.json(
      { jobId: job.id, status: job.status },
      {
        status: job.status === 'QUEUED' ? 202 : 200,
        headers: { Location: `/api/fabrika/hunting/jobs/${job.id}` },
      }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
