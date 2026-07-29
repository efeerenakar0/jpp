import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  createHuntJob: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/hunting-v2/job-service', () => ({
  createHuntJob: mocks.createHuntJob,
}));

vi.mock('@/lib/hunting-v2/rate-limit', () => ({
  enforceHuntingRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  principalActor: () => ({ key: 'OWNER:owner-a' }),
  huntingApiError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 400 }
    ),
}));

import { POST } from './route';

describe('eski bulk-analyze uyumluluk katmanı', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.createHuntJob.mockResolvedValue({
      id: 'job-a',
      status: 'QUEUED',
    });
  });

  it('sahte ilan üretmek yerine tenant kapsamlı HuntJob oluşturur', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/bulk-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.sahibinden.com/satilik',
          idempotencyKey: 'request-0001',
        }),
      })
    );

    expect(response.status).toBe(202);
    expect(mocks.createHuntJob).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      createdBy: 'OWNER:owner-a',
      body: {
        provider: 'SAHIBINDEN',
        searchUrl: 'https://www.sahibinden.com/satilik',
        sourceAuthorizationId: undefined,
        idempotencyKey: 'request-0001',
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      deprecated: true,
      jobId: 'job-a',
      status: 'QUEUED',
    });
  });
});
