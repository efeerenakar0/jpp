import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findCopy: vi.fn(),
  updateCopy: vi.fn(),
  updateCampaigns: vi.fn(),
  transaction: vi.fn(),
  findCampaigns: vi.fn(),
  findProperties: vi.fn(),
  findWebsiteAnalyses: vi.fn(),
  findPosterAssets: vi.fn(),
  findVideoAssets: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/platform-ai-readiness', () => ({
  isPlatformTextAiReady: () => true,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    adCampaign: {
      findMany: mocks.findCampaigns,
      updateMany: mocks.updateCampaigns,
    },
    adCopy: { findFirst: mocks.findCopy, update: mocks.updateCopy },
    crmProperty: { findMany: mocks.findProperties },
    crmPropertyMedia: { findMany: mocks.findPosterAssets },
    studioVideoJob: { findMany: mocks.findVideoAssets },
    marketingWebsiteAnalysis: { findMany: mocks.findWebsiteAnalyses },
    $transaction: mocks.transaction,
  },
}));

import { GET, PATCH } from './route';

describe('/api/fabrika/marketing/campaigns PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a', companyName: 'Acme Emlak' },
      member: null,
    });
    mocks.findCopy.mockResolvedValue({
      id: 'copy-1',
      campaignId: 'campaign-1',
      campaign: { publicationStatus: 'EXPORTED' },
    });
    mocks.updateCopy.mockResolvedValue({ id: 'copy-1', approved: false });
    mocks.updateCampaigns.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        adCopy: { update: mocks.updateCopy },
        adCampaign: { updateMany: mocks.updateCampaigns },
      }),
    );
    mocks.findCampaigns.mockResolvedValue([]);
    mocks.findProperties.mockResolvedValue([]);
    mocks.findWebsiteAnalyses.mockResolvedValue([]);
    mocks.findPosterAssets.mockResolvedValue([]);
    mocks.findVideoAssets.mockResolvedValue([]);
  });

  it('lists only tenant-owned completed poster and video works without storage keys', async () => {
    mocks.findPosterAssets.mockResolvedValue([
      {
        id: 'poster-1',
        propertyId: 'property-a',
        url: 'https://cdn.example.test/poster.png',
        fileName: 'poster.png',
        width: 1080,
        height: 1350,
        prompt: 'Zarif emlak posteri',
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
        property: {
          id: 'property-a',
          title: 'Sahil Evi',
          referenceCode: 'P-1',
        },
      },
    ]);
    mocks.findVideoAssets.mockResolvedValue([
      {
        id: 'video-1',
        propertyId: 'property-a',
        outputFileName: 'video.mp4',
        userCommand: 'Sinematik tanıtım',
        prompt: 'Plan',
        ratio: '9:16',
        durationSeconds: 15,
        createdAt: new Date('2026-08-05T11:00:00.000Z'),
        property: {
          id: 'property-a',
          title: 'Sahil Evi',
          referenceCode: 'P-1',
        },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findPosterAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyAccountId: 'company-a' }),
      }),
    );
    expect(mocks.findVideoAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyAccountId: 'company-a' }),
      }),
    );
    expect(mocks.findProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          media: expect.objectContaining({
            where: expect.objectContaining({ archivedAt: null }),
            take: 12,
          }),
        }),
      }),
    );
    expect(body.creativeAssets).toEqual([
      expect.objectContaining({
        id: 'video-1',
        kind: 'VIDEO',
        propertyId: 'property-a',
      }),
      expect.objectContaining({
        id: 'poster-1',
        kind: 'POSTER',
        propertyId: 'property-a',
      }),
    ]);
    expect(JSON.stringify(body.creativeAssets)).not.toContain('storageKey');
  });

  it('dışa aktarılmış bir metin yeniden taslağa alınınca eski yayın paketini atomik olarak geçersiz kılar', async () => {
    const response = await PATCH(
      new Request('https://example.test/api/fabrika/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adCopyId: 'copy-1', approved: false }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateCampaigns).toHaveBeenCalledWith({
      where: {
        id: 'campaign-1',
        companyAccountId: 'company-a',
        publicationStatus: { not: 'DRAFT' },
      },
      data: expect.objectContaining({
        publicationStatus: 'DRAFT',
        exportedAt: null,
        externalPublicationUrl: null,
        publicationProofUrl: null,
        manuallyConfirmedAt: null,
        manuallyConfirmedById: null,
      }),
    });
  });
});
