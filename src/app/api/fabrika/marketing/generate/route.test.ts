import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findProperty: vi.fn(),
  findPoster: vi.fn(),
  findVideo: vi.fn(),
  createCampaign: vi.fn(),
  callAi: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/marketing-ai', () => ({ callCompanyMarketingAI: mocks.callAi }));
vi.mock('@/lib/fabrika-notifications', () => ({
  createCompanyNotification: mocks.notify,
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    crmProperty: { findFirst: mocks.findProperty },
    crmPropertyMedia: { findFirst: mocks.findPoster },
    studioVideoJob: { findFirst: mocks.findVideo },
    adCampaign: { create: mocks.createCampaign },
  },
}));

import { POST } from './route';

const property = {
  id: 'property-a',
  companyAccountId: 'company-a',
  title: 'Sahil Evi',
  referenceCode: 'P-104',
  location: 'Alanya',
  price: 9_000_000,
  roomCount: '3+1',
  area: 160,
  description: 'Deniz manzaralı',
  imageUrl: 'https://example.test/property.jpg',
};

describe('/api/fabrika/marketing/generate POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a', companyName: 'Acme Emlak' },
    });
    mocks.findProperty.mockResolvedValue(property);
    mocks.findPoster.mockResolvedValue(null);
    mocks.findVideo.mockResolvedValue(null);
    mocks.callAi.mockResolvedValue({
      provider: 'TEST',
      model: 'test-model',
      content: JSON.stringify({ name: 'AI kampanyası', adCopies: [] }),
    });
    mocks.createCampaign.mockImplementation(async ({ data }) => ({
      id: 'campaign-1',
      ...data,
      property,
      adCopies: data.adCopies.create,
    }));
    mocks.notify.mockResolvedValue(undefined);
  });

  it('rejects a creative asset that is not found inside the current tenant', async () => {
    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'listing',
          propertyId: 'property-a',
          creativeAsset: { id: 'poster-other-tenant', kind: 'POSTER' },
          channels: ['INSTAGRAM'],
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.findPoster).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'poster-other-tenant',
          companyAccountId: 'company-a',
        }),
      }),
    );
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it('uses tenant-owned creative metadata and generates only selected channels', async () => {
    mocks.findPoster.mockResolvedValue({
      id: 'poster-1',
      propertyId: 'property-a',
      fileName: 'sahil-poster.png',
      prompt: 'Doğal, sıcak aile yaşamı',
      width: 1080,
      height: 1350,
      createdAt: new Date('2026-08-05T10:00:00.000Z'),
      url: 'https://private.example.test/poster.png',
      property: { id: 'property-a', title: 'Sahil Evi', referenceCode: 'P-104' },
    });

    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'listing',
          propertyId: 'property-a',
          creativeAsset: { id: 'poster-1', kind: 'POSTER' },
          channels: ['INSTAGRAM', 'WHATSAPP'],
        }),
      }),
    );

    expect(response.status).toBe(201);
    const messages = mocks.callAi.mock.calls[0][1];
    const prompt = messages.map((message: { content: string }) => message.content).join('\n');
    expect(prompt).toContain('sahil-poster.png');
    expect(prompt).toContain('Doğal, sıcak aile yaşamı');
    expect(prompt).not.toContain('private.example.test');
    expect(mocks.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adCopies: {
            create: [
              expect.objectContaining({ platform: 'INSTAGRAM' }),
              expect.objectContaining({ platform: 'WHATSAPP' }),
            ],
          },
        }),
      }),
    );
  });
});
