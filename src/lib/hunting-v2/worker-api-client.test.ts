import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createRemoteHuntWorkerStore } from './worker-api-client';

const invocation = {
  version: 1 as const,
  jobId: 'job-a',
  capability: 'capability-token-with-at-least-thirty-two-characters',
};
const environment = {
  AVCI_WORKER_API_URL: 'https://app.test/api/internal/hunting-worker',
  ACTOR_RUN_ID: 'actor-run-a',
};

describe('Avci remote worker API client', () => {
  it('kisa omurlu capability ile yalniz imzali ise claim gonderir', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        job: {
          id: 'job-a',
          provider: 'SAHIBINDEN',
          searchUrl: 'https://www.sahibinden.com/satilik',
          status: 'RUNNING',
          startedAt: '2026-08-11T10:00:00.000Z',
        },
      })
    );
    const store = createRemoteHuntWorkerStore(invocation, {
      environment,
      fetchImpl,
    });

    await expect(store.claim()).resolves.toMatchObject({ id: 'job-a' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(environment.AVCI_WORKER_API_URL);
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${invocation.capability}`,
      'X-Apify-Run-Id': 'actor-run-a',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'claim',
      jobId: 'job-a',
    });
    expect(url).not.toContain(invocation.capability);
  });

  it('saglayici hata govdesini sizdirmadan fail-closed davranir', async () => {
    const store = createRemoteHuntWorkerStore(invocation, {
      environment,
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('database-secret', { status: 500 })),
    });

    await expect(store.claim()).rejects.toThrow('HTTP 500');
    await expect(store.claim()).rejects.not.toThrow('database-secret');
  });

  it('guvensiz veya eksik API adresini reddeder', () => {
    expect(() =>
      createRemoteHuntWorkerStore(invocation, {
        environment: { AVCI_WORKER_API_URL: 'http://example.com/internal' },
      })
    ).toThrow('guvenli degil');
    expect(() =>
      createRemoteHuntWorkerStore(invocation, { environment: {} })
    ).toThrow('eksik');
  });
});
