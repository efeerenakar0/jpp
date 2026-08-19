import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  submit: vi.fn(),
  retrieve: vi.fn(),
  persist: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    studioVideoJob: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock('@/lib/bannerbear-video', () => {
  class BannerbearVideoError extends Error {
    constructor(message: string, public code: string, public status = 502) {
      super(message);
    }
  }
  return {
    BannerbearVideoError,
    submitBannerbearSlideshow: mocks.submit,
    getBannerbearSlideshowStatus: mocks.retrieve,
  };
});

vi.mock('@/lib/studio-video/artifact-storage', () => ({
  persistStudioVideoArtifact: mocks.persist,
}));

import { processNextBannerbearPosterVideoJob } from './bannerbear-poster-video-jobs';

const now = new Date('2026-08-19T08:00:00.000Z');

function job(status: 'QUEUED' | 'GENERATING') {
  return {
    id: 'banner-job-a',
    companyAccountId: 'company-a',
    propertyId: 'property-a',
    provider: 'BANNERBEAR',
    providerTaskId: status === 'GENERATING' ? 'tool-a' : null,
    providerOutputUrl: null,
    referenceMediaIds: ['media-a', 'media-b'],
    referenceSnapshot: [
      { id: 'media-a', fileName: 'a.jpg', url: 'https://assets.test/a.jpg' },
      { id: 'media-b', fileName: 'b.jpg', url: 'https://assets.test/b.jpg' },
    ],
    userCommand: '2 fotoğraf · fade geçiş',
    durationSeconds: 6,
    ratio: '9:16',
    status,
    progress: status === 'QUEUED' ? 8 : 55,
    attemptCount: 0,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: now,
  };
}

describe('Bannerbear poster video queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    process.env.BANNERBEAR_API_KEY = 'test-key';
  });

  it('submits only a Bannerbear job and releases it for polling', async () => {
    mocks.findFirst.mockResolvedValue(job('QUEUED'));
    mocks.submit.mockResolvedValue({ providerRequestId: 'tool-a' });

    const result = await processNextBannerbearPosterVideoJob({ now, workerId: 'worker-a' });

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ provider: 'BANNERBEAR' }),
    }));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      imageUrls: ['https://assets.test/a.jpg', 'https://assets.test/b.jpg'],
      format: 'story',
      transition: 'fade',
    }));
    expect(result).toMatchObject({ ok: true, status: 'GENERATING' });
  });

  it('persists a completed Bannerbear result and marks the job completed', async () => {
    mocks.findFirst.mockResolvedValue(job('GENERATING'));
    mocks.retrieve.mockResolvedValue({
      status: 'COMPLETED',
      progress: 100,
      videoUrl: 'https://videos.test/final.mp4',
    });
    mocks.persist.mockResolvedValue({
      storageKey: 'studio-video/company-a/banner-job-a/output.mp4',
      fileName: 'portfoy-video.mp4',
      mimeType: 'video/mp4',
      byteSize: 2048,
    });

    const result = await processNextBannerbearPosterVideoJob({ now, workerId: 'worker-a' });

    expect(mocks.persist).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      jobId: 'banner-job-a',
      sourceUrl: 'https://videos.test/final.mp4',
    });
    expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED', progress: 100 }),
    }));
    expect(result).toMatchObject({ ok: true, status: 'COMPLETED' });
  });
});
