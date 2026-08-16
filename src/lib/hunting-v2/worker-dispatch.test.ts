import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { dispatchQueuedHuntWorker } from './worker-dispatch';

const actorInput = {
  startUrls: [
    'https://www.sahibinden.com/emlak-konut/antalya-alanya-oba/sahibinden',
  ] as [string],
  enrichment: true as const,
  maxResults: 50,
};

describe('ClearPath Avci worker tetikleyicisi', () => {
  it('tetikleme modu kapaliyken dis servise istek gondermez', async () => {
    const fetchImpl = vi.fn();
    await expect(dispatchQueuedHuntWorker(actorInput, { env: {}, fetchImpl })).resolves.toEqual({
      status: 'disabled',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('resmi /acts endpointine exact actor input ve server-side token ile baslar', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'run-123',
            defaultDatasetId: 'dataset-123',
            status: 'READY',
          },
        }),
        { status: 201 }
      )
    );
    await expect(
      dispatchQueuedHuntWorker(actorInput, {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_TOKEN: 'secret-apify-token',
        },
        fetchImpl,
      })
    ).resolves.toEqual({
      status: 'started',
      runId: 'run-123',
      datasetId: 'dataset-123',
      actorId: 'clearpath~sahibinden-scraper-pro',
      apifyStatus: 'READY',
    });

    const [requestUrl, requestInit] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const url = new URL(requestUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://api.apify.com/v2/acts/clearpath~sahibinden-scraper-pro/runs'
    );
    expect(url.searchParams.get('memory')).toBe('1024');
    expect(url.searchParams.get('timeout')).toBe('600');
    expect(url.searchParams.get('maxTotalChargeUsd')).toBe('0.75');
    expect(requestInit.body).toBe(JSON.stringify(actorInput));
    expect(requestInit.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer secret-apify-token' })
    );
    expect(requestUrl).not.toContain('secret-apify-token');
  });

  it('eski APIFY_AVCI_ACTOR_ID degeri ClearPath actorunu ezemez', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'run-123' } }), { status: 201 })
    );
    await dispatchQueuedHuntWorker(actorInput, {
      env: {
        AVCI_WORKER_DISPATCH_MODE: 'apify',
        APIFY_AVCI_ACTOR_ID: 'legacy~worker',
        APIFY_TOKEN: 'secret-apify-token',
      },
      fetchImpl,
    });
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      'clearpath~sahibinden-scraper-pro'
    );
  });

  it('eksik token ve saglayici hatasinda fail-closed davranir', async () => {
    await expect(
      dispatchQueuedHuntWorker(actorInput, {
        env: { AVCI_WORKER_DISPATCH_MODE: 'apify' },
        fetchImpl: vi.fn(),
      })
    ).rejects.toThrow('Apify worker ayarlari eksik');
    await expect(
      dispatchQueuedHuntWorker(actorInput, {
        env: {
          AVCI_WORKER_DISPATCH_MODE: 'apify',
          APIFY_TOKEN: 'secret',
        },
        fetchImpl: vi.fn().mockResolvedValue(new Response('secret', { status: 401 })),
      })
    ).rejects.toThrow('Worker baslatilamadi');
  });
});
