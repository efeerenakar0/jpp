import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        property: { title: 'Boğaz Manzaralı Daire' },
      },
    ]);
  });

  it('returns active AI video jobs scoped to the current tenant and member', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findStudioVideoJobs).toHaveBeenCalledWith({
      where: {
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
        status: { in: ['QUEUED', 'SUBMITTING', 'GENERATING', 'PERSISTING'] },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
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
});
