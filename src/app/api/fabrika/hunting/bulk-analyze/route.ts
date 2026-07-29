import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { createHuntJob } from '@/lib/hunting-v2/job-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

const legacyBodySchema = z
  .object({
    url: z.string().url().max(3000),
    sourceAuthorizationId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(8).max(160).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `bulk-compat:${principal.account.id}:${actor.key}`,
      { limit: 5, windowMs: 60_000 }
    );
    const body = legacyBodySchema.parse(await request.json());
    const job = await createHuntJob({
      companyAccountId: principal.account.id,
      createdBy: actor.key,
      body: {
        provider: 'SAHIBINDEN',
        searchUrl: body.url,
        sourceAuthorizationId: body.sourceAuthorizationId,
        idempotencyKey: body.idempotencyKey,
      },
    });
    return NextResponse.json(
      {
        success: true,
        deprecated: true,
        jobId: job.id,
        status: job.status,
        message:
          'Toplu analiz Avcı v2 iş kuyruğuna aktarıldı; sahte ilan üretilmedi.',
      },
      { status: 202 }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
