import 'server-only';

import { z } from 'zod';
import {
  CLEARPATH_ACTOR_ID,
  type ClearpathActorInput,
} from './clearpath-contract';

type DispatchEnvironment = Readonly<Record<string, string | undefined>>;

type DispatchDependencies = {
  env?: DispatchEnvironment;
  fetchImpl?: typeof fetch;
};

const apifyRunResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    defaultDatasetId: z.string().min(1).optional().nullable(),
    status: z.string().optional(),
  }),
});

export type WorkerDispatchResult =
  | { status: 'disabled' }
  | {
      status: 'started';
      runId: string;
      datasetId: string | null;
      actorId: string;
      apifyStatus: string | null;
    };

const APIFY_RUN_MEMORY_MB = 1024;
const APIFY_RUN_TIMEOUT_SECONDS = 600;
const APIFY_MAX_TOTAL_CHARGE_USD = 0.75;
const APIFY_REQUEST_TIMEOUT_MS = 10_000;

function apifyRunUrl(actorId: string) {
  const url = new URL(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`
  );
  url.searchParams.set('memory', String(APIFY_RUN_MEMORY_MB));
  url.searchParams.set('timeout', String(APIFY_RUN_TIMEOUT_SECONDS));
  url.searchParams.set('maxTotalChargeUsd', String(APIFY_MAX_TOTAL_CHARGE_USD));
  return url;
}

export async function dispatchQueuedHuntWorker(
  input?: ClearpathActorInput,
  dependencies: DispatchDependencies = {}
): Promise<WorkerDispatchResult> {
  const env = dependencies.env || process.env;
  const mode = env.AVCI_WORKER_DISPATCH_MODE?.trim().toLowerCase();
  if (!mode) return { status: 'disabled' };
  if (mode !== 'apify') {
    throw new Error('Desteklenmeyen Avci worker tetikleme modu.');
  }
  if (!input) {
    throw new Error('Apify job girdisi eksik.');
  }

  const actorId = env.APIFY_CLEARPATH_ACTOR_ID?.trim() || CLEARPATH_ACTOR_ID;
  const token = env.APIFY_TOKEN?.trim();
  if (!token) throw new Error('Apify worker ayarlari eksik.');

  const fetchImpl = dependencies.fetchImpl || fetch;
  let response: Response;
  try {
    response = await fetchImpl(apifyRunUrl(actorId), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout(APIFY_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('Worker baslatilamadi; kuyruktaki is korunuyor.');
  }
  if (!response.ok) {
    throw new Error('Worker baslatilamadi; kuyruktaki is korunuyor.');
  }
  const parsed = apifyRunResponseSchema.safeParse(
    await response.json().catch(() => null)
  );
  if (!parsed.success) {
    throw new Error('Worker yaniti dogrulanamadi; kuyruktaki is korunuyor.');
  }
  return {
    status: 'started',
    runId: parsed.data.data.id,
    datasetId: parsed.data.data.defaultDatasetId || null,
    actorId,
    apifyStatus: parsed.data.data.status || null,
  };
}

type ApifyRunState = {
  id: string;
  status: string;
  defaultDatasetId: string | null;
  finishedAt: string | null;
};

export async function fetchApifyRunState(
  runId: string,
  dependencies: DispatchDependencies = {}
): Promise<ApifyRunState> {
  const env = dependencies.env || process.env;
  const token = env.APIFY_TOKEN?.trim();
  if (!token) throw new Error('Apify worker ayarlari eksik.');
  const response = await (dependencies.fetchImpl || fetch)(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,
    {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(APIFY_REQUEST_TIMEOUT_MS),
    }
  );
  if (!response.ok) throw new Error('Apify is durumu alinamadi.');
  const payload = z
    .object({
      data: z.object({
        id: z.string(),
        status: z.string(),
        defaultDatasetId: z.string().nullable().optional(),
        finishedAt: z.string().nullable().optional(),
      }),
    })
    .parse(await response.json());
  return {
    id: payload.data.id,
    status: payload.data.status,
    defaultDatasetId: payload.data.defaultDatasetId || null,
    finishedAt: payload.data.finishedAt || null,
  };
}

export async function fetchApifyDatasetItems(
  datasetId: string,
  dependencies: DispatchDependencies = {}
): Promise<unknown[]> {
  const env = dependencies.env || process.env;
  const token = env.APIFY_TOKEN?.trim();
  if (!token) throw new Error('Apify worker ayarlari eksik.');
  const url = new URL(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`
  );
  url.searchParams.set('clean', 'true');
  url.searchParams.set('format', 'json');
  const response = await (dependencies.fetchImpl || fetch)(url.toString(), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('Apify sonuc verisi alinamadi.');
  return z.array(z.unknown()).parse(await response.json());
}

export async function abortApifyRun(
  runId: string,
  dependencies: DispatchDependencies = {}
) {
  const env = dependencies.env || process.env;
  const token = env.APIFY_TOKEN?.trim();
  if (!token) return;
  await (dependencies.fetchImpl || fetch)(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/abort`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(APIFY_REQUEST_TIMEOUT_MS),
    }
  ).catch(() => undefined);
}
