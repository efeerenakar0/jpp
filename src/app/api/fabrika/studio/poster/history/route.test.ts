import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  class SessionError extends Error {}
  return {
    SessionError,
    requirePrincipal: vi.fn(),
    findPosterAttempts: vi.fn(),
    findVideoJobs: vi.fn(),
  };
});

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: mocks.SessionError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    studioPosterGenerationAttempt: { findMany: mocks.findPosterAttempts },
    studioVideoJob: { findMany: mocks.findVideoJobs },
  },
}));

import { GET } from './route';

describe('/api/fabrika/studio/poster/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: null,
    });
    mocks.findPosterAttempts.mockResolvedValue([
      {
        id: 'poster-a',
        sequence: 0,
        outputUrl: 'https://assets.test/poster-a.jpg',
        outputStorageKey: 'studio-posters/a/poster-a-story.jpg',
        outputByteSize: 1234,
        completedAt: new Date('2026-08-18T10:00:00.000Z'),
        createdAt: new Date('2026-08-18T09:59:00.000Z'),
        generation: {
          propertyId: 'property-a',
          property: { title: 'Deniz Manzaralı Villa', location: 'Alanya / Kargıcak' },
        },
      },
    ]);
    mocks.findVideoJobs.mockResolvedValue([
      {
        id: 'video-a',
        propertyId: 'property-a',
        property: { title: 'Deniz Manzaralı Villa', location: 'Alanya / Kargıcak' },
        referenceSnapshot: [{ url: 'https://assets.test/cover.jpg' }],
        durationSeconds: 12,
        ratio: '9:16',
        outputFileName: 'villa-video.mp4',
        outputByteSize: 4567,
        completedAt: new Date('2026-08-18T11:00:00.000Z'),
        createdAt: new Date('2026-08-18T10:58:00.000Z'),
      },
    ]);
  });

  it('groups completed photos and videos into the same property folder', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.totals).toEqual({ photos: 1, videos: 1 });
    expect(body.folders).toHaveLength(1);
    expect(body.folders[0]).toMatchObject({
      id: 'property-a',
      name: 'Deniz Manzaralı Villa',
      photos: [{ id: 'poster-a', format: 'story' }],
      videos: [
        {
          id: 'video-a',
          thumbnailUrl: 'https://assets.test/cover.jpg',
          url: '/api/fabrika/studio/video/jobs/video-a/artifact',
        },
      ],
    });
  });

  it('scopes employee history to the signed-in member', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });

    await GET();

    expect(mocks.findPosterAttempts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyAccountId: 'company-a',
          generation: { createdByMemberId: 'member-a' },
        }),
      })
    );
    expect(mocks.findVideoJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyAccountId: 'company-a',
          createdByMemberId: 'member-a',
        }),
      })
    );
  });

  it('requires a Fabrika session', async () => {
    mocks.requirePrincipal.mockRejectedValue(new mocks.SessionError('Oturum gerekli.'));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.findPosterAttempts).not.toHaveBeenCalled();
    expect(mocks.findVideoJobs).not.toHaveBeenCalled();
  });
});
