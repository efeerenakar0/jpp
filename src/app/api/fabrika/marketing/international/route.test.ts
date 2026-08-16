import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findProperty: vi.fn(),
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

describe('/api/fabrika/marketing/international POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a', companyName: 'Acme Emlak' },
    });
    mocks.findProperty.mockResolvedValue(property);
    mocks.callAi.mockResolvedValue({
      provider: 'TEST',
      model: 'test-model',
      content: '{}',
    });
    mocks.createCampaign.mockImplementation(async ({ data }) => ({
      id: 'campaign-1',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      ...data,
      property,
      adCopies: [],
    }));
    mocks.notify.mockResolvedValue(undefined);
  });

  it('creates a package only for the explicitly selected portal', async () => {
    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/international', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'property-a',
          countryCode: 'DE',
          portalId: 'immobilienscout24-de',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const aiPrompt = mocks.callAi.mock.calls[0][1]
      .map((message: { content: string }) => message.content)
      .join('\n');
    expect(aiPrompt).toContain('immobilienscout24-de');
    expect(aiPrompt).not.toContain('kleinanzeigen');
    expect(aiPrompt).toContain('Kaynak fiyat TRY');

    const createInput = mocks.createCampaign.mock.calls[0][0].data;
    expect(createInput.internationalPlan.portalCopies).toHaveLength(1);
    expect(createInput.internationalPlan.portalCopies[0].portalId).toBe(
      'immobilienscout24-de',
    );
  });

  it('rejects a portal that does not belong to the selected country', async () => {
    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/international', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'property-a',
          countryCode: 'DE',
          portalId: 'rightmove',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findProperty).not.toHaveBeenCalled();
    expect(mocks.callAi).not.toHaveBeenCalled();
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it('rejects a catalog portal marked unsupported for Turkey properties', async () => {
    const response = await POST(
      new Request('https://example.test/api/fabrika/marketing/international', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'property-a',
          countryCode: 'US',
          portalId: 'zillow',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findProperty).not.toHaveBeenCalled();
    expect(mocks.callAi).not.toHaveBeenCalled();
  });
});
