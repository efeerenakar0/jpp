import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  findMany: vi.fn(),
  findListing: vi.fn(),
  findEvent: vi.fn(),
  txFindEvent: vi.fn(),
  updateListing: vi.fn(),
  upsertImport: vi.fn(),
  createEvent: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
  createNotification: vi.fn(),
  callAI: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/fabrika-notifications', () => ({
  createCompanyNotification: mocks.createNotification,
}));

vi.mock('@/lib/ai', () => ({ callAI: mocks.callAI }));

vi.mock('@/lib/prisma', () => ({
  default: {
    huntedListing: {
      findMany: mocks.findMany,
      findFirst: mocks.findListing,
    },
    operationEvent: { findUnique: mocks.findEvent },
    $transaction: mocks.transaction,
  },
}));

import { GET, PATCH } from './route';

const principal = {
  type: 'OWNER',
  account: { id: 'company-a' },
  member: null,
};

const listing = {
  id: 'listing-a',
  companyAccountId: 'company-a',
  title: 'Oba 2+1 daire',
  status: 'YELLOW',
  sourceUrl: 'https://example.test/listing-a',
  sourceProvider: 'MANUAL_IMPORT',
  price: '4.500.000 TL',
  location: 'Alanya / Oba',
  roomCount: '2+1',
  area: '110',
  notes: null,
  imageUrl: null,
  rawData: null,
  authorizationNote: null,
  authorizedAt: null,
};

describe('/api/fabrika/hunting/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue(principal);
    mocks.findMany.mockResolvedValue([]);
    mocks.findListing.mockResolvedValue(listing);
    mocks.findEvent.mockResolvedValue(null);
    mocks.txFindEvent.mockResolvedValue(null);
    mocks.updateListing.mockResolvedValue({ ...listing, status: 'AUTHORIZED' });
    mocks.upsertImport.mockResolvedValue({ id: 'import-a' });
    mocks.createEvent.mockResolvedValue({ id: 'event-a' });
    mocks.createAudit.mockResolvedValue({ id: 'audit-a' });
    mocks.createNotification.mockResolvedValue({ id: 'notification-a' });
    mocks.callAI.mockResolvedValue({ content: 'Tarafsız özet.' });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        operationEvent: {
          findUnique: mocks.txFindEvent,
          create: mocks.createEvent,
        },
        huntedListing: {
          update: mocks.updateListing,
          findUniqueOrThrow: mocks.findListing,
        },
        portfolioImportItem: { upsert: mocks.upsertImport },
        managerAuditLog: { create: mocks.createAudit },
      })
    );
  });

  it('lists only the authenticated company records', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyAccountId: 'company-a' },
        select: expect.objectContaining({ createdAt: true }),
      })
    );
  });

  it('records an authorized transition, import and audit atomically', async () => {
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/hunting/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: listing.id,
          status: 'AUTHORIZED',
          idempotencyKey: 'status-change-unique-1',
          authorizationNote: 'Malik onayı dosyada.',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsertImport).toHaveBeenCalledTimes(1);
    expect(mocks.createEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        listingId: listing.id,
        idempotencyKey: 'status-change-unique-1',
        eventType: 'AUTHORIZATION_CONFIRMED',
      }),
    });
    expect(mocks.createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        entityId: listing.id,
        operation: 'HUNTING_STATUS_CHANGE',
      }),
    });
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it('returns the previous result without applying a duplicate idempotency key', async () => {
    mocks.findEvent.mockResolvedValue({ id: 'event-existing' });
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/hunting/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: listing.id,
          status: 'AUTHORIZED',
          idempotencyKey: 'status-change-duplicate',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ idempotent: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});
