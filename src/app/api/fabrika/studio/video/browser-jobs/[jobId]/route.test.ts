import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  SessionError: class SessionError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
  requirePrincipal: vi.fn(),
  updateJob: vi.fn(),
  serialize: vi.fn((job: { id: string; status: string }) => ({ id: job.id, status: job.status })),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));
vi.mock('@/lib/studio-video/browser-jobs', () => ({
  updateBrowserRemotionJob: mocks.updateJob,
  serializeBrowserRemotionJob: mocks.serialize,
}));

import { PATCH } from './route';

describe('PATCH /api/fabrika/studio/video/browser-jobs/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({ account: { id: 'company-a' }, type: 'OWNER', member: null });
    mocks.updateJob.mockResolvedValue({ id: 'job-a', status: 'COMPLETED' });
  });

  it('updates a tenant-owned browser render stage through the domain service', async () => {
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/studio/video/browser-jobs/job-a', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'COMPLETED', progress: 100, outputFileName: 'villa.mp4', outputMimeType: 'video/mp4', outputByteSize: 42 }),
      }),
      { params: Promise.resolve({ jobId: 'job-a' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.updateJob).toHaveBeenCalledWith(
      { companyAccountId: 'company-a', memberId: null },
      'job-a',
      expect.objectContaining({ stage: 'COMPLETED', outputByteSize: 42 }),
    );
  });

  it('rejects unknown mutation fields', async () => {
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/studio/video/browser-jobs/job-a', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'RENDERING', progress: 40, providerKey: 'forbidden' }),
      }),
      { params: Promise.resolve({ jobId: 'job-a' }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.updateJob).not.toHaveBeenCalled();
  });
});
