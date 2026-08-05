import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  class SessionError extends Error {}
  class ForbiddenError extends Error {}
  class JobError extends Error {
    constructor(
      message: string,
      public status = 400,
      public code = 'INVALID_REQUEST'
    ) {
      super(message);
    }
  }
  return {
    SessionError,
    ForbiddenError,
    JobError,
    requirePrincipal: vi.fn(),
    getJob: vi.fn(),
    cancelJob: vi.fn(),
    serializeJob: vi.fn((job: { id: string; status?: string }) => ({
      id: job.id,
      status: job.status,
    })),
  };
});

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/studio-video/jobs', () => ({
  StudioVideoJobError: mocks.JobError,
  getOwnedStudioVideoJob: mocks.getJob,
  cancelStudioVideoJob: mocks.cancelJob,
  serializeStudioVideoJob: mocks.serializeJob,
}));

import { DELETE, GET } from './route';

describe('/api/fabrika/studio/video/jobs/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      type: 'OWNER',
      member: null,
    });
    mocks.getJob.mockResolvedValue({ id: 'job-a', status: 'GENERATING' });
    mocks.cancelJob.mockResolvedValue({ id: 'job-a', status: 'CANCELLED' });
  });

  it('gets an owner-visible job within the authenticated tenant', async () => {
    const response = await GET(new Request('https://app.test/unused'), {
      params: Promise.resolve({ jobId: 'job-a' }),
    } as never);

    expect(mocks.getJob).toHaveBeenCalledWith(
      { companyAccountId: 'company-a', memberId: null },
      'job-a'
    );
    await expect(response.json()).resolves.toEqual({
      job: { id: 'job-a', status: 'GENERATING' },
    });
  });

  it('cancels only the employee own job', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      type: 'EMPLOYEE',
      member: { id: 'member-a' },
    });

    const response = await DELETE(new Request('https://app.test/unused'), {
      params: Promise.resolve({ jobId: 'job-a' }),
    } as never);

    expect(mocks.cancelJob).toHaveBeenCalledWith(
      { companyAccountId: 'company-a', memberId: 'member-a' },
      'job-a'
    );
    await expect(response.json()).resolves.toEqual({
      job: { id: 'job-a', status: 'CANCELLED' },
    });
  });

  it('rejects an invalid job path parameter before querying', async () => {
    const response = await GET(new Request('https://app.test/unused'), {
      params: Promise.resolve({ jobId: '../storage-key' }),
    } as never);

    expect(response.status).toBe(400);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });

  it('preserves a domain not-found status without exposing internals', async () => {
    mocks.getJob.mockRejectedValue(
      new mocks.JobError('Video işi bulunamadı.', 404, 'JOB_NOT_FOUND')
    );

    const response = await GET(new Request('https://app.test/unused'), {
      params: Promise.resolve({ jobId: 'job-missing' }),
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Video işi bulunamadı.',
      code: 'JOB_NOT_FOUND',
    });
  });
});
