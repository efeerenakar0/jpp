import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  SessionError: class SessionError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
  requirePrincipal: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
  serialize: vi.fn((job: { id: string }) => ({ id: job.id })),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));
vi.mock('@/lib/studio-video/browser-jobs', () => ({
  createBrowserRemotionJob: mocks.createJob,
  listBrowserRemotionJobs: mocks.listJobs,
  serializeBrowserRemotionJob: mocks.serialize,
}));

import { PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS } from '@/remotion/portfolio-video/fixture';
import { GET, POST } from './route';

describe('/api/fabrika/studio/video/browser-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      type: 'EMPLOYEE',
      member: { id: 'member-a' },
    });
    mocks.listJobs.mockResolvedValue([{ id: 'job-a' }]);
    mocks.createJob.mockResolvedValue({ id: 'job-a' });
  });

  it('lists only actor-owned browser render metadata', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.listJobs).toHaveBeenCalledWith({ companyAccountId: 'company-a', memberId: 'member-a' });
    await expect(response.json()).resolves.toEqual({ jobs: [{ id: 'job-a' }] });
  });

  it('creates a validated job without requiring or invoking an external provider', async () => {
    const response = await POST(new Request('https://app.test/api/fabrika/studio/video/browser-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property-a',
        mediaIds: ['media-a'],
        command: 'Sinematik video',
        storyboard: PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS.storyboard,
        fingerprint: 'fingerprint-a',
        seed: 104,
        idempotencyKey: 'render-a',
      }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.createJob).toHaveBeenCalledWith(expect.objectContaining({
      actor: { companyAccountId: 'company-a', memberId: 'member-a' },
      idempotencyKey: 'render-a',
    }));
  });
});
