import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { dispatchQueuedHuntWorker } from './worker-dispatch';

const signingSecret =
  'test-only-worker-signing-secret-with-more-than-32-characters';

describe('Avcı worker tetikleyicisi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tetikleme modu kapalıyken dış servise istek göndermez', async () => {
    const fetchImpl = vi.fn();

    await expect(
      dispatchQueuedHuntWorker('job-a', { env: {}, fetchImpl })
    ).resolves.toEqual({ status: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Apify Actor çalıştırmasını bearer token ve harcama sınırıyla başlatır', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'run-123' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );

    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_AVCI_ACTOR_ID: 'efeerenakar0~business-ai-portfoy-uzmani',
          APIFY_TOKEN: 'secret-apify-token',
          AVCI_WORKER_SIGNING_SECRET: signingSecret,
        },
        fetchImpl,
      })
    ).resolves.toEqual({ status: 'started', runId: 'run-123' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const url = new URL(requestUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://api.apify.com/v2/actors/efeerenakar0~business-ai-portfoy-uzmani/runs'
    );
    expect(url.searchParams.get('memory')).toBe('2048');
    expect(url.searchParams.get('timeout')).toBe('900');
    expect(url.searchParams.get('maxTotalChargeUsd')).toBe('0.25');
    expect(requestInit).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer secret-apify-token',
        'Content-Type': 'application/json',
      }),
    });
    const actorInput = JSON.parse(String(requestInit.body));
    expect(actorInput).toMatchObject({
      version: 1,
      jobId: 'job-a',
      capability: expect.any(String),
    });
    expect(String(requestInit.body)).not.toContain('DATABASE_URL');
    expect(String(requestInit.body)).not.toContain('HUNTING_CONTACT');
    expect(requestUrl).not.toContain('secret-apify-token');
  });

  it('eksik ayarda fail-closed davranır ve sağlayıcı yanıtını sızdırmaz', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('secret-apify-token', { status: 401 })
    );

    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_AVCI_ACTOR_ID: 'actor-id',
          APIFY_TOKEN: 'secret-apify-token',
          AVCI_WORKER_SIGNING_SECRET: signingSecret,
        },
        fetchImpl,
      })
    ).rejects.toThrow('Worker başlatılamadı');

    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: { AVCI_WORKER_DISPATCH_MODE: 'apify' },
        fetchImpl,
      })
    ).rejects.toThrow('Apify worker ayarları eksik');
  });

  it('desteklenmeyen modu ve ağ hatasını güvenli mesajla reddeder', async () => {
    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: { AVCI_WORKER_DISPATCH_MODE: 'unknown' },
        fetchImpl: vi.fn(),
      })
    ).rejects.toThrow('Desteklenmeyen');

    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_AVCI_ACTOR_ID: 'actor-id',
          APIFY_TOKEN: 'secret-apify-token',
          AVCI_WORKER_SIGNING_SECRET: signingSecret,
        },
        fetchImpl: vi.fn().mockRejectedValue(new Error('secret network body')),
      })
    ).rejects.toThrow('Worker başlatılamadı');
  });

  it('başarılı HTTP yanıtında doğrulanabilir run kimliği ister', async () => {
    await expect(
      dispatchQueuedHuntWorker('job-a', {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_AVCI_ACTOR_ID: 'actor-id',
          APIFY_TOKEN: 'secret-apify-token',
          AVCI_WORKER_SIGNING_SECRET: signingSecret,
        },
        fetchImpl: vi
          .fn()
          .mockResolvedValue(new Response('not-json', { status: 201 })),
      })
    ).rejects.toThrow('yanıtı doğrulanamadı');
  });
});
