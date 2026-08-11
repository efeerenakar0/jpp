import { ZodError } from 'zod';
import { verifyHuntWorkerCapability } from '@/lib/hunting-v2/worker-capability';
import { createLocalHuntWorkerStore } from '@/lib/hunting-v2/worker-local-store';
import {
  detailFromWire,
  huntWorkerRequestSchema,
  searchListingsFromWire,
} from '@/lib/hunting-v2/worker-protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 512 * 1024;

class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function bearerToken(request: Request) {
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new WorkerApiError('Yetkisiz worker istegi.', 401);
  return match[1];
}

async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new WorkerApiError('JSON istek govdesi gerekli.', 415);
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new WorkerApiError('Worker istegi cok buyuk.', 413);
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new WorkerApiError('Worker istegi cok buyuk.', 413);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new WorkerApiError('Worker JSON govdesi gecersiz.', 400);
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    let capability;
    try {
      capability = verifyHuntWorkerCapability(token);
    } catch {
      throw new WorkerApiError('Yetkisiz worker istegi.', 401);
    }
    const body = huntWorkerRequestSchema.parse(await readBody(request));
    if (body.jobId !== capability.jobId) {
      throw new WorkerApiError('Yetkisiz worker istegi.', 401);
    }

    const store = createLocalHuntWorkerStore({
      jobId: capability.jobId,
      allowMediaCopy: false,
    });

    switch (body.action) {
      case 'claim': {
        const job = await store.claim();
        if (!job) {
          throw new WorkerApiError('Worker isi claim edilemedi.', 409);
        }
        return json({ job });
      }
      case 'control':
        return json({ directive: await store.control(body.jobId) });
      case 'discover':
        await store.discover(
          body.jobId,
          searchListingsFromWire(body.items),
          body.progress
        );
        return json({ ok: true });
      case 'detail':
        await store.detail(
          body.jobId,
          detailFromWire(body.detail),
          body.progress
        );
        return json({ ok: true });
      case 'progress':
        await store.progress(
          body.jobId,
          body.progress,
          body.errorCode
            ? {
                code: body.errorCode,
                summary: body.errorSummary,
              }
            : undefined
        );
        return json({ ok: true });
      case 'finish':
        await store.finish(
          body.jobId,
          body.outcome,
          body.progress,
          body.errorSummary
        );
        return json({ ok: true });
    }
  } catch (error) {
    if (error instanceof WorkerApiError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof ZodError) {
      return json({ error: 'Worker istek govdesi dogrulanamadi.' }, 400);
    }
    return json({ error: 'Worker API istegi tamamlanamadi.' }, 500);
  }
}
