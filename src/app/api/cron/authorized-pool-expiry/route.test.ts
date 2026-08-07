import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ expire: vi.fn() }));

vi.mock('@/lib/authorized-portfolio-pool-service', () => ({
  expireAuthorizedPortfolioShares: mocks.expire,
}));

import { GET } from './route';

describe('GET /api/cron/authorized-pool-expiry', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('fails closed without the cron secret', async () => {
    const response = await GET(new Request('https://app.test/api/cron/authorized-pool-expiry'));

    expect(response.status).toBe(401);
    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it('expires shares once with the server clock after authorization', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    mocks.expire.mockResolvedValue({ count: 3 });

    const response = await GET(
      new Request('https://app.test/api/cron/authorized-pool-expiry', {
        headers: { authorization: 'Bearer cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.expire).toHaveBeenCalledWith(expect.any(Date));
    await expect(response.json()).resolves.toEqual({ success: true, expired: 3 });
  });
});
