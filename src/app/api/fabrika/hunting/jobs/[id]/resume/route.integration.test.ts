import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  updateMany: vi.fn(),
  enforceRateLimit: vi.fn(),
  dispatchQueuedHuntWorker: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    huntJob: {
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock('@/lib/hunting-v2/rate-limit', () => ({
  enforceHuntingRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/hunting-v2/worker-dispatch', () => ({
  dispatchQueuedHuntWorker: mocks.dispatchQueuedHuntWorker,
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

describe('Avcı job resume route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.dispatchQueuedHuntWorker.mockResolvedValue({
      status: 'started',
      runId: 'run-a',
    });
  });

  it('yalnız aynı tenant içindeki duraklatılmış işi kuyruğa alır', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/jobs/job-a/resume', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ id: 'job-a' }),
      } as Parameters<typeof POST>[1]
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      jobId: 'job-a',
      status: 'QUEUED',
      workerRunId: 'run-a',
    });
    expect(mocks.dispatchQueuedHuntWorker).toHaveBeenCalledWith('job-a');
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-a',
        companyAccountId: 'company-a',
        status: {
          in: ['PAUSED', 'PARTIAL', 'FAILED', 'SOURCE_CHALLENGE'],
        },
      },
      data: {
        status: 'QUEUED',
        pausedAt: null,
        completedAt: null,
        errorSummary: null,
      },
    });
  });

  it('başka tenant veya devam ettirilemez durum için fail-closed davranır', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/jobs/job-b/resume', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ id: 'job-b' }),
      } as Parameters<typeof POST>[1]
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Devam ettirilebilir av işi bulunamadı.',
    });
  });
});
