import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  requirePrincipal: vi.fn(),
  sourceCreate: vi.fn(),
  sourceFindMany: vi.fn(),
  importGroupBy: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => {
  class SessionError extends Error {}
  class ForbiddenError extends Error {}
  return {
    FabrikaSessionError: SessionError,
    FabrikaForbiddenError: ForbiddenError,
    requireFabrikaOwner: mocks.requireOwner,
    requireFabrikaPrincipal: mocks.requirePrincipal,
  };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    portfolioSource: {
      create: mocks.sourceCreate,
      findMany: mocks.sourceFindMany,
    },
    portfolioImportItem: { groupBy: mocks.importGroupBy },
  },
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('https://app.test/api/fabrika/portfolio-sources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fabrika/portfolio-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({
      account: { id: 'company-a' },
      permissions: { canManageSecrets: true },
    });
    mocks.sourceCreate.mockResolvedValue({ id: 'source-a' });
    mocks.sourceFindMany.mockResolvedValue([]);
    mocks.importGroupBy.mockResolvedValue([]);
  });

  it('creates a tenant-scoped source without accepting customer credentials', async () => {
    const response = await POST(
      request({
        name: 'Akar Group sitesi',
        type: 'HTML',
        baseUrl: 'https://akar.example',
        feedPath: '/api/properties',
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.sourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        encryptedCredential: null,
        credentialHint: null,
      }),
      select: { id: true },
    });
  });

  it('rejects an injected API key instead of storing it', async () => {
    const response = await POST(
      request({
        name: 'Akar Group sitesi',
        type: 'HTML',
        baseUrl: 'https://akar.example',
        apiKey: 'customer-secret-must-not-be-stored',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mocks.sourceCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain('customer-secret-must-not-be-stored');
  });
});
