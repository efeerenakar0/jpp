import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFabrikaJobs } from './FabrikaJobIndicator';

describe('fetchFabrikaJobs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears the indicator data when polling fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(fetchFabrikaJobs()).resolves.toEqual([]);
  });

  it('clears the indicator data when polling is aborted or rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(fetchFabrikaJobs()).resolves.toEqual([]);
  });
});
