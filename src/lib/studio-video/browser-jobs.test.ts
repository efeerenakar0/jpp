import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  propertyFindFirst: vi.fn(),
  jobFindUnique: vi.fn(),
  jobFindFirst: vi.fn(),
  jobFindMany: vi.fn(),
  jobUpsert: vi.fn(),
  jobUpdateMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmProperty: { findFirst: mocks.propertyFindFirst },
    studioVideoJob: {
      findUnique: mocks.jobFindUnique,
      findFirst: mocks.jobFindFirst,
      findMany: mocks.jobFindMany,
      upsert: mocks.jobUpsert,
      updateMany: mocks.jobUpdateMany,
    },
  },
}));

import { PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS } from '@/remotion/portfolio-video/fixture';
import {
  createBrowserRemotionJob,
  listBrowserRemotionJobs,
  updateBrowserRemotionJob,
} from './browser-jobs';

const now = new Date('2026-08-07T08:00:00.000Z');
const actor = { companyAccountId: 'company-a', memberId: 'member-a' };
const media = [
  {
    id: 'media-a',
    url: 'https://assets.example.test/a.jpg',
    fileName: 'a.jpg',
    isCover: true,
  },
];
const storyboard = {
  ...PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS.storyboard,
  photoUrls: [media[0].url],
};

function job(status = 'QUEUED') {
  return {
    id: 'browser-job-a',
    companyAccountId: 'company-a',
    propertyId: 'property-a',
    createdByMemberId: 'member-a',
    prompt: storyboard.planSummary,
    userCommand: 'Sinematik video',
    referenceMediaIds: ['media-a'],
    referenceSnapshot: { media, storyboard, fingerprint: 'fingerprint-a', seed: 104 },
    provider: 'BROWSER_REMOTION',
    model: 'PortfolioPromoVideo:web-renderer',
    providerTaskId: null,
    providerOutputUrl: null,
    durationSeconds: 15,
    ratio: '9:16',
    resolution: '1080p',
    generateAudio: false,
    status,
    progress: 0,
    idempotencyKey: 'render-a',
    attemptCount: 0,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    outputStorageKey: null,
    outputFileName: null,
    outputMimeType: null,
    outputByteSize: null,
    errorCode: null,
    errorMessage: null,
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('browser Remotion video jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.propertyFindFirst.mockResolvedValue({ id: 'property-a', title: 'Villa', media });
    mocks.jobFindUnique.mockResolvedValue(null);
    mocks.jobFindFirst.mockResolvedValue(job());
    mocks.jobFindMany.mockResolvedValue([job()]);
    mocks.jobUpsert.mockImplementation(async ({ create }) => ({ ...job(), ...create }));
    mocks.jobUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('creates an idempotent browser-only job after tenant and media validation', async () => {
    await createBrowserRemotionJob({
      actor,
      propertyId: 'property-a',
      mediaIds: ['media-a'],
      command: 'Sinematik video',
      storyboard,
      fingerprint: 'fingerprint-a',
      seed: 104,
      idempotencyKey: 'render-a',
      now,
    });

    expect(mocks.propertyFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyAccountId: 'company-a', id: 'property-a' }),
    }));
    expect(mocks.jobUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: 'company-a',
          idempotencyKey: 'render-a',
        },
      },
      create: expect.objectContaining({
        provider: 'BROWSER_REMOTION',
        model: 'PortfolioPromoVideo:web-renderer',
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
        status: 'QUEUED',
      }),
      update: {},
    }));
  });

  it('rejects cross-tenant or altered media before persistence', async () => {
    mocks.propertyFindFirst.mockResolvedValue({ id: 'property-a', title: 'Villa', media: [] });

    await expect(createBrowserRemotionJob({
      actor,
      propertyId: 'property-a',
      mediaIds: ['media-a'],
      command: 'Sinematik video',
      storyboard,
      fingerprint: 'fingerprint-a',
      seed: 104,
      idempotencyKey: 'render-a',
      now,
    })).rejects.toMatchObject({ code: 'MEDIA_FORBIDDEN', status: 403 });
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });

  it('lists only browser jobs belonging to the actor tenant and member', async () => {
    await listBrowserRemotionJobs(actor);
    expect(mocks.jobFindMany).toHaveBeenCalledWith({
      where: {
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
        provider: 'BROWSER_REMOTION',
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  });

  it('moves render progress forward and completes without pretending the MP4 is stored', async () => {
    mocks.jobFindFirst.mockResolvedValue(job('GENERATING'));
    mocks.jobFindFirst.mockResolvedValueOnce(job('GENERATING')).mockResolvedValueOnce(job('COMPLETED'));

    const result = await updateBrowserRemotionJob(actor, 'browser-job-a', {
      stage: 'COMPLETED',
      progress: 100,
      outputFileName: 'villa.mp4',
      outputMimeType: 'video/mp4',
      outputByteSize: 123_456,
    }, now);

    expect(mocks.jobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'browser-job-a',
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
        provider: 'BROWSER_REMOTION',
        status: 'GENERATING',
      },
      data: expect.objectContaining({
        status: 'COMPLETED',
        progress: 100,
        outputStorageKey: null,
        completedAt: now,
      }),
    });
    expect(result.status).toBe('COMPLETED');
  });

  it('persists increasing progress while the browser stays in the same render stage', async () => {
    const current = { ...job('GENERATING'), progress: 20 };
    const latest = { ...current, progress: 60 };
    mocks.jobFindFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(latest);

    const result = await updateBrowserRemotionJob(
      actor,
      'browser-job-a',
      { stage: 'RENDERING', progress: 60 },
      now,
    );

    expect(mocks.jobUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'browser-job-a',
        status: 'GENERATING',
        progress: { lt: 60 },
      }),
      data: { progress: 60 },
    });
    expect(result.progress).toBe(60);
  });

  it('keeps duplicate cancel and retry transitions idempotent', async () => {
    mocks.jobFindFirst.mockResolvedValue(job('CANCELLED'));

    await updateBrowserRemotionJob(actor, 'browser-job-a', { stage: 'CANCELLED', progress: 0 }, now);
    expect(mocks.jobUpdateMany).not.toHaveBeenCalled();

    mocks.jobFindFirst.mockResolvedValueOnce(job('FAILED')).mockResolvedValueOnce(job('SUBMITTING'));
    await updateBrowserRemotionJob(actor, 'browser-job-a', { stage: 'RETRY', progress: 0 }, now);
    expect(mocks.jobUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.jobUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUBMITTING', attemptCount: { increment: 1 } }),
    }));
  });
});
