import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  propertyFindFirst: vi.fn(),
  mediaFindMany: vi.fn(),
  jobFindUnique: vi.fn(),
  jobFindFirst: vi.fn(),
  jobCreate: vi.fn(),
  jobUpdate: vi.fn(),
  jobUpdateMany: vi.fn(),
  generateVideo: vi.fn(),
  waitVideo: vi.fn(),
  persistVideo: vi.fn(),
  processPosterVideoJob: vi.fn(),
  afterTasks: [] as Promise<unknown>[],
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (callback: () => unknown) => {
      mocks.afterTasks.push(Promise.resolve().then(callback));
    },
  };
});

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    crmProperty: { findFirst: mocks.propertyFindFirst },
    crmPropertyMedia: { findMany: mocks.mediaFindMany },
    studioVideoJob: {
      findUnique: mocks.jobFindUnique,
      findFirst: mocks.jobFindFirst,
      create: mocks.jobCreate,
      update: mocks.jobUpdate,
      updateMany: mocks.jobUpdateMany,
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
    generateBannerbearSlideshow: mocks.generateVideo,
    waitForBannerbearSlideshow: mocks.waitVideo,
  };
});
vi.mock('@/lib/studio-video/artifact-storage', () => ({
  persistStudioVideoArtifact: mocks.persistVideo,
}));
vi.mock('@/lib/bannerbear-poster-video-jobs', () => ({
  processNextBannerbearPosterVideoJob: mocks.processPosterVideoJob,
}));

import { POST } from './route';

describe('POST /api/fabrika/studio/poster/video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterTasks.length = 0;
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    mocks.propertyFindFirst.mockResolvedValue({ id: 'property-a', title: 'Villa' });
    mocks.mediaFindMany.mockResolvedValue([
      { id: 'media-a', url: 'https://blob.test/a.jpg', fileName: 'a.jpg' },
      { id: 'media-b', url: 'https://blob.test/b.jpg', fileName: 'b.jpg' },
    ]);
    mocks.jobFindUnique.mockResolvedValue(null);
    mocks.jobFindFirst.mockResolvedValue({
      id: 'video-job-a',
      status: 'QUEUED',
      progress: 8,
      providerTaskId: null,
      providerOutputUrl: null,
    });
    mocks.jobCreate.mockResolvedValue({ id: 'video-job-a', progress: 8 });
    mocks.jobUpdate.mockResolvedValue({});
    mocks.jobUpdateMany.mockResolvedValue({ count: 1 });
    mocks.generateVideo.mockImplementation(async (input: {
      onSubmitted?: (id: string) => Promise<void>;
      onProgress?: (progress: number) => Promise<void>;
    }) => {
      await input.onSubmitted?.('bannerbear-video-a');
      await input.onProgress?.(60);
      return {
        videoUrl: 'https://videos.bannerbear.com/a.mp4',
        providerRequestId: 'bannerbear-video-a',
        durationSeconds: 6,
      };
    });
    mocks.persistVideo.mockResolvedValue({
      storageKey: 'studio-video/company-a/video-job-a/output.mp4',
      fileName: 'portfoy-ai-video.mp4',
      mimeType: 'video/mp4',
      byteSize: 1234,
    });
    mocks.processPosterVideoJob.mockResolvedValue({
      ok: true,
      jobId: 'video-job-a',
      status: 'GENERATING',
    });
    process.env.BANNERBEAR_API_KEY = 'test-key';
  });

  it('yalnız şirkete ait seçili fotoğraflarla videoyu oluşturup güvenli depoya kaydeder', async () => {
    const response = await POST(new Request('https://app.test/api/fabrika/studio/poster/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property-a',
        mediaIds: ['media-a', 'media-b'],
        format: 'story',
        transition: 'fade',
        slideDuration: 3,
      }),
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      pending: true,
      jobId: 'video-job-a',
      durationSeconds: 6,
      photoCount: 2,
    });
    await Promise.all(mocks.afterTasks);
    expect(mocks.jobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        propertyId: 'property-a',
        provider: 'BANNERBEAR',
        model: 'bannerbear-v5-create-video-slideshow',
        referenceMediaIds: ['media-a', 'media-b'],
      }),
    });
    expect(mocks.processPosterVideoJob).toHaveBeenCalledWith({ jobId: 'video-job-a' });
  });

  it('başka hesaba ait eksik fotoğraf varsa Bannerbear çağrısı yapmaz', async () => {
    mocks.mediaFindMany.mockResolvedValue([
      { id: 'media-a', url: 'https://blob.test/a.jpg', fileName: 'a.jpg' },
    ]);
    const response = await POST(new Request('https://app.test/api/fabrika/studio/poster/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'property-a',
        mediaIds: ['media-a', 'foreign-media'],
        format: 'post',
      }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.generateVideo).not.toHaveBeenCalled();
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });
});
