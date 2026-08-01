import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
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
  import('../../../../../lib/website-integration')
);

vi.mock('@/lib/prisma', () => {
  const transactionClient = {
    crmProperty: {
      create: mocks.create,
      upsert: mocks.upsert,
    },
    crmActivity: { create: mocks.activityCreate },
  };
  return {
    default: {
      crmProperty: {
        findMany: mocks.findMany,
      },
      $transaction: vi.fn(
        (callback: (client: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      ),
    },
  };
});

import { GET, POST } from './route';

describe('/api/site/v1/portfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      integration: { id: 'integration-a', status: 'READY' },
    });
    mocks.findMany.mockResolvedValue([]);
    mocks.activityCreate.mockResolvedValue({ id: 'activity-a' });
  });

  it('lists only the authenticated company portfolio', async () => {
    const response = await GET(
      new Request('https://app.test/api/site/v1/portfolio?scope=all')
    );

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyAccountId: 'company-a',
          status: { not: 'ARCHIVED' },
        },
      })
    );
  });

  it('creates the property inside the API key company and records an audit activity', async () => {
    mocks.create.mockResolvedValue({
      id: 'property-a',
      title: 'Deniz manzaralı 2+1',
      status: 'ACTIVE',
    });

    const response = await POST(
      new Request('https://app.test/api/site/v1/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Deniz manzaralı 2+1',
          location: 'Alanya',
          price: 250000,
          status: 'ACTIVE',
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyAccountId: 'company-a',
          title: 'Deniz manzaralı 2+1',
        }),
      })
    );
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        propertyId: 'property-a',
        type: 'WEBSITE_API_PROPERTY_UPSERTED',
      }),
    });
  });

  it('rejects malformed portfolio input before writing data', async () => {
    const response = await POST(
      new Request('https://app.test/api/site/v1/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', price: -1 }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
