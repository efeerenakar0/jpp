import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  activityCreate: vi.fn(),
}));

vi.mock('@/lib/website-api-auth', () => ({
  requireWebsiteApiPrincipal: mocks.requirePrincipal,
  websiteApiError: (error: unknown) =>
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'API hatası',
      },
      { status: 500 }
    ),
  websiteApiPreflight: vi.fn(() => new Response(null, { status: 204 })),
  websiteApiResponse: (
    _request: Request,
    _principal: unknown,
    body: unknown,
    init?: ResponseInit
  ) => Response.json(body, init),
}));

vi.mock('@/lib/website-integration', async () =>
  import('../../../../../../lib/website-integration')
);

vi.mock('@/lib/property-publication', () => ({
  isPropertyPublishable: vi.fn(() => true),
  publicationEligibilityWhere: (companyAccountId: string) => ({
    companyAccountId,
    status: { in: ['ACTIVE', 'RESERVED'] },
    publicationApprovedAt: { not: null },
    authorityDocumentVerifiedAt: { not: null },
    publicationBlockedAt: null,
  }),
}));

vi.mock('@/lib/prisma', () => {
  const transactionClient = {
    crmProperty: { update: mocks.update },
    crmActivity: { create: mocks.activityCreate },
  };
  return {
    default: {
      crmProperty: {
        findFirst: mocks.findFirst,
      },
      $transaction: vi.fn(
        (callback: (client: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      ),
    },
  };
});

import { DELETE, PATCH } from './route';

const context = {
  params: Promise.resolve({ id: 'property-a' }),
} as RouteContext<'/api/site/v1/portfolio/[id]'>;

describe('/api/site/v1/portfolio/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      integration: { id: 'integration-a', status: 'READY' },
    });
    mocks.findFirst.mockResolvedValue({ id: 'property-a' });
    mocks.activityCreate.mockResolvedValue({ id: 'activity-a' });
  });

  it('updates only a property owned by the API key company', async () => {
    mocks.update.mockResolvedValue({
      id: 'property-a',
      title: 'Güncel başlık',
      status: 'ACTIVE',
    });

    const response = await PATCH(
      new Request(
        'https://app.test/api/site/v1/portfolio/property-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Güncel başlık' }),
        }
      ),
      context
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'property-a', companyAccountId: 'company-a' },
      select: { id: true },
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-a' },
        data: expect.objectContaining({ title: 'Güncel başlık' }),
      })
    );
  });

  it('soft-deletes by archiving the portfolio and records the action', async () => {
    mocks.update.mockResolvedValue({
      id: 'property-a',
      title: 'Arşivlenecek portföy',
      status: 'ARCHIVED',
    });

    const response = await DELETE(
      new Request('https://app.test/api/site/v1/portfolio/property-a', {
        method: 'DELETE',
      }),
      context
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-a' },
        data: { status: 'ARCHIVED' },
      })
    );
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        propertyId: 'property-a',
        type: 'WEBSITE_API_PROPERTY_ARCHIVED',
      }),
    });
  });

  it('does not reveal or update another company property', async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await PATCH(
      new Request(
        'https://app.test/api/site/v1/portfolio/property-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Yetkisiz güncelleme' }),
        }
      ),
      context
    );

    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
