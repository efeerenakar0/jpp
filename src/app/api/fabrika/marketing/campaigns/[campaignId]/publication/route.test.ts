import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    adCampaign: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));

import { GET, POST } from './route';

const fixture = {
  id: 'campaign-1',
  companyAccountId: 'company-a',
  name: 'Oba kampanyası',
  description: null,
  objective: 'Talep',
  audience: 'Aileler',
  publicationStatus: 'READY_TO_PUBLISH',
  exportPackage: null,
  exportedAt: null,
  externalPublicationUrl: null,
  publicationProofUrl: null,
  manuallyConfirmedAt: null,
  manuallyConfirmedById: null,
  posterHeadline: 'Oba’da yaşam',
  posterSubline: '2+1',
  posterCta: 'Bilgi alın',
  property: {
    id: 'property-1',
    title: 'Oba 2+1',
    referenceCode: 'P-104',
    location: 'Alanya / Oba',
    price: 5_850_000,
  },
  adCopies: [
    {
      approved: true,
      platform: 'INSTAGRAM',
      headline: 'Oba’da ferah 2+1',
      body: 'Doğrulanmış portföy metni.',
      callToAction: 'Bilgi alın',
      targetUrl: 'https://example.com/p-104',
    },
  ],
};

describe('/api/fabrika/marketing/campaigns/[campaignId]/publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.findFirst.mockResolvedValue(fixture);
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('kampanyayı her zaman oturumdaki şirkete göre yükler', async () => {
    const response = await GET(
      new Request('https://example.test/api/fabrika/marketing/campaigns/campaign-1/publication'),
      { params: Promise.resolve({ campaignId: 'campaign-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'campaign-1', companyAccountId: 'company-a' },
      }),
    );
  });

  it('onaysız kanal metni varken kampanyayı yayına hazır yapmaz', async () => {
    mocks.findFirst.mockResolvedValue({
      ...fixture,
      publicationStatus: 'DRAFT',
      adCopies: [{ ...fixture.adCopies[0], approved: false }],
    });

    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/campaigns/campaign-1/publication', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'PREPARE' }),
      }),
      { params: Promise.resolve({ campaignId: 'campaign-1' }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('yayın paketini dürüst EXPORTED durumuyla ve karşılaştırmalı güncellemeyle saklar', async () => {
    mocks.findFirst
      .mockResolvedValueOnce(fixture)
      .mockResolvedValueOnce({
        ...fixture,
        publicationStatus: 'EXPORTED',
        exportPackage: { publicationClaim: 'NOT_PUBLISHED' },
      });

    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/campaigns/campaign-1/publication', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'EXPORT' }),
      }),
      { params: Promise.resolve({ campaignId: 'campaign-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'campaign-1',
          companyAccountId: 'company-a',
          publicationStatus: 'READY_TO_PUBLISH',
        }),
        data: expect.objectContaining({
          publicationStatus: 'EXPORTED',
          exportPackage: expect.objectContaining({ publicationClaim: 'NOT_PUBLISHED' }),
        }),
      }),
    );
  });

  it('dış platform kanıtı olmadan manuel yayın doğrulamaz', async () => {
    mocks.findFirst.mockResolvedValue({ ...fixture, publicationStatus: 'EXPORTED' });

    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/campaigns/campaign-1/publication', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'CONFIRM' }),
      }),
      { params: Promise.resolve({ campaignId: 'campaign-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('daha önce dışa aktarılan paketi özel JSON dosyası olarak indirir', async () => {
    mocks.findFirst.mockResolvedValue({
      ...fixture,
      publicationStatus: 'EXPORTED',
      exportPackage: { version: 1, publicationClaim: 'NOT_PUBLISHED' },
    });

    const response = await GET(
      new Request(
        'https://example.test/api/fabrika/marketing/campaigns/campaign-1/publication?download=1',
      ),
      { params: Promise.resolve({ campaignId: 'campaign-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      publicationClaim: 'NOT_PUBLISHED',
    });
  });
});
