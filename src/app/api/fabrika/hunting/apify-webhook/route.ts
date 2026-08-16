import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { huntingApiError } from '@/lib/hunting-v2/api';
import { synchronizeClearpathJob } from '@/lib/hunting-v2/clearpath-ingest';

export const runtime = 'nodejs';

const payloadSchema = z
  .object({
    eventType: z.string().optional(),
    resource: z.object({ id: z.string() }).optional(),
    actorRunId: z.string().optional(),
  })
  .passthrough();

function authorized(request: Request) {
  const configured = process.env.APIFY_HUNTING_WEBHOOK_SECRET?.trim();
  const supplied = request.headers.get('x-hunting-webhook-secret')?.trim();
  if (!configured || !supplied) return false;
  const expected = createHash('sha256').update(configured).digest();
  const actual = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  try {
    if (!authorized(request)) {
      return Response.json({ error: 'Webhook yetkisi gecersiz.' }, { status: 401 });
    }
    const payload = payloadSchema.parse(await request.json());
    const runId = payload.actorRunId || payload.resource?.id;
    if (!runId) throw new Error('Apify run kimligi eksik.');
    const jobs = await prisma.huntJob.findMany({
      where: {
        status: { in: ['QUEUED', 'RUNNING'] },
        OR: [
          { apifyRunId: runId },
          { searchCache: { is: { apifyRunId: runId } } },
        ],
      },
      select: { id: true },
    });
    const results = [];
    for (const job of jobs) results.push(await synchronizeClearpathJob(job.id));
    return Response.json({ ok: true, processed: results.length });
  } catch (error) {
    return huntingApiError(error);
  }
}
