import 'server-only';

import { z } from 'zod';
import type { HuntWorkerStore } from './worker-store';
import {
  detailToWire,
  huntWorkerInvocationSchema,
  huntWorkerJobSchema,
} from './worker-protocol';

type WorkerApiEnvironment = Readonly<Record<string, string | undefined>>;

const okSchema = z.object({ ok: z.literal(true) }).strict();
const claimResponseSchema = z
  .object({ job: huntWorkerJobSchema })
  .strict();
const controlResponseSchema = z
  .object({ directive: z.enum(['CONTINUE', 'CANCEL', 'PAUSE']) })
  .strict();

function workerApiUrl(environment: WorkerApiEnvironment) {
  const raw = environment.AVCI_WORKER_API_URL?.trim();
  if (!raw) throw new Error('Avci worker API adresi eksik.');
  const url = new URL(raw);
  const localTestHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.test');
  if ((url.protocol !== 'https:' && !localTestHost) || url.username || url.password) {
    throw new Error('Avci worker API adresi guvenli degil.');
  }
  return url.toString();
}

export function createRemoteHuntWorkerStore(
  invocationInput: unknown,
  dependencies: {
    environment?: WorkerApiEnvironment;
    fetchImpl?: typeof fetch;
  } = {}
): HuntWorkerStore {
  const invocation = huntWorkerInvocationSchema.parse(invocationInput);
  const environment = dependencies.environment || process.env;
  const endpoint = workerApiUrl(environment);
  const fetchImpl = dependencies.fetchImpl || fetch;

  async function call(payload: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${invocation.capability}`,
          'Content-Type': 'application/json',
          ...(environment.ACTOR_RUN_ID
            ? { 'X-Apify-Run-Id': environment.ACTOR_RUN_ID }
            : {}),
        },
        body: JSON.stringify({ ...payload, jobId: invocation.jobId }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error('Avci worker API baglantisi kurulamadi.');
    }
    if (!response.ok) {
      throw new Error(
        `Avci worker API istegi reddedildi (HTTP ${response.status}).`
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error('Avci worker API yaniti dogrulanamadi.');
    }
  }

  return {
    async claim() {
      const response = claimResponseSchema.parse(
        await call({ action: 'claim' })
      );
      return response.job;
    },
    async control() {
      const response = controlResponseSchema.parse(
        await call({ action: 'control' })
      );
      return response.directive;
    },
    async discover(_jobId, items, progress) {
      okSchema.parse(
        await call({ action: 'discover', items, progress })
      );
    },
    async detail(_jobId, detail, progress) {
      okSchema.parse(
        await call({
          action: 'detail',
          detail: detailToWire(detail),
          progress,
        })
      );
    },
    async progress(_jobId, progress, error) {
      okSchema.parse(
        await call({
          action: 'progress',
          progress,
          ...(error
            ? { errorCode: error.code, errorSummary: error.summary }
            : {}),
        })
      );
    },
    async finish(_jobId, outcome, progress, errorSummary) {
      okSchema.parse(
        await call({
          action: 'finish',
          outcome,
          progress,
          ...(errorSummary ? { errorSummary } : {}),
        })
      );
    },
  };
}
