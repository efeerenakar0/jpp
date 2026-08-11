import 'server-only';

import { randomUUID } from 'node:crypto';
import { createHuntWorkerCapability } from './worker-capability';

type DispatchEnvironment = Readonly<Record<string, string | undefined>>;

type DispatchDependencies = {
  env?: DispatchEnvironment;
  fetchImpl?: typeof fetch;
};

type ApifyRunResponse = {
  data?: {
    id?: unknown;
  };
};

export type WorkerDispatchResult =
  | { status: 'disabled' }
  | { status: 'started'; runId: string };

const APIFY_RUN_MEMORY_MB = 2048;
const APIFY_RUN_TIMEOUT_SECONDS = 900;
const APIFY_MAX_TOTAL_CHARGE_USD = 0.25;
const APIFY_REQUEST_TIMEOUT_MS = 10_000;

function apifyRunUrl(actorId: string) {
  const url = new URL(
    `https://api.apify.com/v2/actors/${encodeURIComponent(actorId)}/runs`
  );
  url.searchParams.set('memory', String(APIFY_RUN_MEMORY_MB));
  url.searchParams.set('timeout', String(APIFY_RUN_TIMEOUT_SECONDS));
  url.searchParams.set(
    'maxTotalChargeUsd',
    String(APIFY_MAX_TOTAL_CHARGE_USD)
  );
  return url;
}

export async function dispatchQueuedHuntWorker(
  jobId: string,
  dependencies: DispatchDependencies = {}
): Promise<WorkerDispatchResult> {
  const env = dependencies.env || process.env;
  const mode = env.AVCI_WORKER_DISPATCH_MODE?.trim().toLowerCase();

  if (!mode) {
    return { status: 'disabled' };
  }
  if (mode !== 'apify') {
    throw new Error('Desteklenmeyen Avcı worker tetikleme modu.');
  }

  const actorId = env.APIFY_AVCI_ACTOR_ID?.trim();
  const token = env.APIFY_TOKEN?.trim();
  if (!actorId || !token) {
    throw new Error('Apify worker ayarları eksik.');
  }

  const fetchImpl = dependencies.fetchImpl || fetch;
  const capability = createHuntWorkerCapability(
    {
      jobId,
      leaseId: randomUUID(),
      lifetimeSeconds: 20 * 60,
    },
    env
  );
  const actorInput = JSON.stringify({
    version: 1,
    jobId,
    capability,
  });
  let response: Response;
  try {
    response = await fetchImpl(apifyRunUrl(actorId), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: actorInput,
      cache: 'no-store',
      signal: AbortSignal.timeout(APIFY_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('Worker başlatılamadı; kuyruktaki iş korunuyor.');
  }

  if (!response.ok) {
    throw new Error('Worker başlatılamadı; kuyruktaki iş korunuyor.');
  }

  const payload = (await response.json().catch(() => null)) as
    | ApifyRunResponse
    | null;
  const runId = payload?.data?.id;
  if (typeof runId !== 'string' || !runId) {
    throw new Error('Worker yanıtı doğrulanamadı; kuyruktaki iş korunuyor.');
  }

  return { status: 'started', runId };
}
