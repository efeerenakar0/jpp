import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  findStudioBatches: vi.fn(),
  findStudioVideoJobs: vi.fn(),
  findHuntJobs: vi.fn(),
  isHunterEnabled: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    studioBatch: { findMany: mocks.findStudioBatches },
    studioVideoJob: { findMany: mocks.findStudioVideoJobs },
    huntJob: { findMany: mocks.findHuntJobs },
  },
}));

vi.mock('@/lib/company-accounts', () => ({
  isHunterEnabled: mocks.isHunterEnabled,
}));

import { GET } from './route';

describe('GET /api/fabrika/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T10:01:00.000Z'));
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    mocks.findStudioBatches.mockResolvedValue([]);
    mocks.findHuntJobs.mockResolvedValue([]);
    mocks.isHunterEnabled.mockReturnValue(false);
    mocks.findStudioVideoJobs.mockResolvedValue([
      {
        id: 'video-a',
        status: 'GENERATING',
        progress: 55,
        createdAt: new Date('2026-08-04T10:00:00.000Z'),
        updatedAt: new Date('2026-08-04T10:00:40.000Z'),
        leaseExpiresAt: null,
        property: { title: 'Boğaz Manzaralı Daire' },
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns active AI video jobs scoped to the current tenant and member', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findStudioVideoJobs).toHaveBeenCalledWith({
      where: {
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
        OR: [
          {
            status: 'QUEUED',
            updatedAt: { gt: new Date('2026-08-04T09:46:00.000Z') },
          },
          {
            status: { in: ['SUBMITTING', 'GENERATING', 'PERSISTING'] },
            OR: [
              { leaseExpiresAt: { gt: new Date('2026-08-04T10:01:00.000Z') } },
              { updatedAt: { gt: new Date('2026-08-04T09:56:00.000Z') } },
            ],
          },
        ],
      },
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
        leaseExpiresAt: true,
        property: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(body.jobs).toEqual([
      {
        id: 'studio-video:video-a',
        kind: 'STUDIO_VIDEO',
        title: 'Boğaz Manzaralı Daire',
        status: 'GENERATING',
        progress: 55,
        href: '/fabrika/studyo?area=video',
        createdAt: '2026-08-04T10:00:00.000Z',
      },
    ]);
  });

  it('hides failed Studio batches and stale worker jobs from the global indicator', async () => {
    mocks.findStudioBatches.mockResolvedValue([
      {
        id: 'studio-failed',
        status: 'PROCESSING',
        createdAt: new Date('2026-08-04T09:59:00.000Z'),
        property: { title: 'Hatalı görseller' },
        items: [
          {
            status: 'FAILED',
            leaseExpiresAt: null,
            updatedAt: new Date('2026-08-04T10:00:30.000Z'),
          },
        ],
      },
      {
        id: 'studio-stale',
        status: 'PROCESSING',
        createdAt: new Date('2026-08-04T09:00:00.000Z'),
        property: null,
        items: [
          {
            status: 'PROCESSING',
            leaseExpiresAt: new Date('2026-08-04T09:30:00.000Z'),
            updatedAt: new Date('2026-08-04T09:15:00.000Z'),
          },
        ],
      },
    ]);
    mocks.findStudioVideoJobs.mockResolvedValue([
      {
        id: 'video-stale',
        status: 'GENERATING',
        progress: 55,
        createdAt: new Date('2026-08-04T09:00:00.000Z'),
        updatedAt: new Date('2026-08-04T09:30:00.000Z'),
        leaseExpiresAt: null,
        property: { title: 'Yarım kalan video' },
      },
    ]);
    mocks.isHunterEnabled.mockReturnValue(true);
    mocks.findHuntJobs.mockResolvedValue([
      {
        id: 'hunt-stale',
        status: 'RUNNING',
        searchUrl: 'https://example.com/search',
        totalCompleted: 2,
        totalDiscovered: 10,
        createdAt: new Date('2026-08-04T09:00:00.000Z'),
        updatedAt: new Date('2026-08-04T09:30:00.000Z'),
        lastHeartbeatAt: new Date('2026-08-04T09:30:00.000Z'),
      },
      {
        id: 'hunt-paused',
        status: 'PAUSED',
        searchUrl: 'https://example.com/search',
        totalCompleted: 2,
        totalDiscovered: 10,
        createdAt: new Date('2026-08-04T10:00:00.000Z'),
        updatedAt: new Date('2026-08-04T10:00:30.000Z'),
        lastHeartbeatAt: new Date('2026-08-04T10:00:30.000Z'),
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.jobs).toEqual([]);
    expect(mocks.findHuntJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: 'QUEUED' }),
            expect.objectContaining({ status: 'RUNNING' }),
          ]),
        }),
      }),
    );
  });

  it('keeps a Studio item visible only while its processing lease is live', async () => {
    mocks.findStudioBatches.mockResolvedValue([
      {
        id: 'studio-live',
        status: 'PROCESSING',
        createdAt: new Date('2026-08-04T10:00:00.000Z'),
        property: { title: 'Canlı görsel işi' },
        items: [
          {
            status: 'PROCESSING',
            leaseExpiresAt: new Date('2026-08-04T10:05:00.000Z'),
            updatedAt: new Date('2026-08-04T09:00:00.000Z'),
          },
        ],
      },
    ]);
    mocks.findStudioVideoJobs.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(body.jobs).toEqual([
      expect.objectContaining({
        id: 'studio:studio-live',
        kind: 'STUDIO',
        status: 'PROCESSING',
      }),
    ]);
  });
});
