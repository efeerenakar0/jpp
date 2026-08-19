import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  cleanupExpiredStudioBatches: vi.fn(),
  cleanupExpiredStudioVideoJobs: vi.fn(),
  processNextBannerbearPosterVideoJob: vi.fn(),
  processNextStudioBatchItem: vi.fn(),
  processNextStudioVideoJob: vi.fn(),
}));

vi.mock('@/lib/studio-batches', () => ({
  cleanupExpiredStudioBatches: mocks.cleanupExpiredStudioBatches,
  processNextStudioBatchItem: mocks.processNextStudioBatchItem,
}));

vi.mock('@/lib/studio-video/jobs', () => ({
  cleanupExpiredStudioVideoJobs: mocks.cleanupExpiredStudioVideoJobs,
  processNextStudioVideoJob: mocks.processNextStudioVideoJob,
}));

vi.mock('@/lib/bannerbear-poster-video-jobs', () => ({
  processNextBannerbearPosterVideoJob:
    mocks.processNextBannerbearPosterVideoJob,
}));

import { GET } from './route';

function cronRequest(authorization = 'Bearer cron-test') {
  return new Request('https://example.test/api/cron/studio-worker', {
    headers: { authorization },
  });
}

describe('studio worker cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-test';
    mocks.cleanupExpiredStudioBatches.mockResolvedValue(2);
    mocks.cleanupExpiredStudioVideoJobs.mockResolvedValue(1);
  });

  it('rejects unauthorized requests before touching either queue', async () => {
    const response = await GET(cronRequest('Bearer wrong'));

    expect(response.status).toBe(401);
    expect(mocks.processNextBannerbearPosterVideoJob).not.toHaveBeenCalled();
    expect(mocks.processNextStudioBatchItem).not.toHaveBeenCalled();
    expect(mocks.processNextStudioVideoJob).not.toHaveBeenCalled();
  });

  it('alternates all studio queues within the shared three-job budget', async () => {
    mocks.processNextStudioBatchItem.mockResolvedValueOnce({
      ok: true,
      itemId: 'image-1',
    });
    mocks.processNextBannerbearPosterVideoJob.mockResolvedValueOnce({
      ok: true,
      jobId: 'poster-video-1',
      status: 'GENERATING',
    });
    mocks.processNextStudioVideoJob.mockResolvedValueOnce({
      ok: true,
      jobId: 'video-1',
      status: 'GENERATING',
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      processed: 3,
      cleaned: 2,
      cleanedImages: 2,
      cleanedVideos: 1,
      results: [
        { kind: 'STUDIO', itemId: 'image-1' },
        { kind: 'POSTER_VIDEO', jobId: 'poster-video-1' },
        { kind: 'STUDIO_VIDEO', jobId: 'video-1' },
      ],
    });
    expect(mocks.processNextStudioBatchItem).toHaveBeenCalledTimes(1);
    expect(mocks.processNextBannerbearPosterVideoJob).toHaveBeenCalledTimes(1);
    expect(mocks.processNextStudioVideoJob).toHaveBeenCalledTimes(1);
  });

  it('falls back to the other queue without spending a processing slot', async () => {
    mocks.processNextStudioBatchItem.mockResolvedValue(null);
    mocks.processNextBannerbearPosterVideoJob.mockResolvedValue(null);
    mocks.processNextStudioVideoJob
      .mockResolvedValueOnce({ ok: true, jobId: 'video-1', status: 'GENERATING' })
      .mockResolvedValueOnce({ ok: true, jobId: 'video-2', status: 'GENERATING' })
      .mockResolvedValueOnce({ ok: true, jobId: 'video-3', status: 'GENERATING' });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body.processed).toBe(3);
    expect(body.results).toEqual([
      expect.objectContaining({ kind: 'STUDIO_VIDEO' }),
      expect.objectContaining({ kind: 'STUDIO_VIDEO' }),
      expect.objectContaining({ kind: 'STUDIO_VIDEO' }),
    ]);
  });
});
