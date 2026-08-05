import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findCopy: vi.fn(),
  updateCopy: vi.fn(),
  updateCampaigns: vi.fn(),
  transaction: vi.fn(),
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
    adCampaign: { findMany: vi.fn(), updateMany: mocks.updateCampaigns },
    adCopy: { findFirst: mocks.findCopy, update: mocks.updateCopy },
    crmProperty: { findMany: vi.fn() },
    marketingWebsiteAnalysis: { findMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from './route';

describe('/api/fabrika/marketing/campaigns PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
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
