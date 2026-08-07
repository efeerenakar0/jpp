import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  listPool: vi.fn(),
  listManagement: vi.fn(),
  publish: vi.fn(),
  requestContact: vi.fn(),
  updateShare: vi.fn(),
  decideContact: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fabrika-session')>()),
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/authorized-portfolio-pool-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authorized-portfolio-pool-service')>()),
  listAuthorizedPortfolioPool: mocks.listPool,
  listPoolManagement: mocks.listManagement,
  publishAuthorizedPoolShare: mocks.publish,
  requestAuthorizedPoolContact: mocks.requestContact,
  updateAuthorizedPoolShare: mocks.updateShare,
  decideAuthorizedPoolContact: mocks.decideContact,
}));

import { GET, PATCH, POST } from './route';

describe('/api/fabrika/authorized-pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.listPool.mockResolvedValue([]);
    mocks.listManagement.mockResolvedValue({ ownedShares: [], incomingRequests: [] });
    mocks.publish.mockResolvedValue({ id: 'share-a' });
    mocks.requestContact.mockResolvedValue({ id: 'request-a' });
  });

  it('lists cross-company inventory only through the sanitized tenant-aware service', async () => {
    const response = await GET(
      new Request('https://app.test/api/fabrika/authorized-pool?location=Alanya')
    );
    expect(response.status).toBe(200);
    expect(mocks.listPool).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({ location: 'Alanya' }),
      expect.any(Date)
    );
  });

  it('does not let an employee publish a company portfolio', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    const response = await POST(
      new Request('https://app.test/api/fabrika/authorized-pool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          propertyId: 'property-a',
          sharePermissionConfirmed: true,
        }),
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('binds a contact request to the authenticated company and idempotency key', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/authorized-pool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'request-contact',
          shareId: 'share-b',
          idempotencyKey: 'pool-request-1234',
        }),
      })
    );
    expect(response.status).toBe(201);
    expect(mocks.requestContact).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterCompanyAccountId: 'company-a',
        shareId: 'share-b',
        idempotencyKey: 'pool-request-1234',
      })
    );
  });

  it('does not let employees decide another company contact request', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/authorized-pool', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'decide-contact',
          requestId: 'request-b',
          decision: 'APPROVED',
        }),
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.decideContact).not.toHaveBeenCalled();
  });
});
