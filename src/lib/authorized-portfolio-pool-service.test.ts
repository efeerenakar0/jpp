import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  createEvents: vi.fn(),
  requestFindUnique: vi.fn(),
  requestFindFirst: vi.fn(),
  requestFindFirstOrThrow: vi.fn(),
  requestUpdateMany: vi.fn(),
  appendManagerAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock('@/lib/digital-manager/events', () => ({
  appendManagerAudit: mocks.appendManagerAudit,
}));

import {
  decideAuthorizedPoolContact,
  expireAuthorizedPortfolioShares,
  requestAuthorizedPoolContact,
} from './authorized-portfolio-pool-service';

describe('expireAuthorizedPortfolioShares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        portfolioPoolShare: {
          findMany: mocks.findMany,
          updateMany: mocks.updateMany,
        },
        operationEvent: { createMany: mocks.createEvents },
        portfolioPoolContactRequest: {
          findUnique: mocks.requestFindUnique,
          findFirst: mocks.requestFindFirst,
          findFirstOrThrow: mocks.requestFindFirstOrThrow,
          updateMany: mocks.requestUpdateMany,
        },
      })
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.createEvents.mockResolvedValue({ count: 1 });
    mocks.requestFindUnique.mockResolvedValue(null);
    mocks.requestFindFirst.mockResolvedValue(null);
    mocks.requestFindFirstOrThrow.mockResolvedValue(null);
    mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.appendManagerAudit.mockResolvedValue(undefined);
  });

  it('expires due shares and writes idempotent tenant-scoped events', async () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    mocks.findMany.mockResolvedValue([
      {
        id: 'share-a',
        ownerCompanyAccountId: 'company-a',
        propertyId: 'property-a',
        authorityExpiresAt: new Date('2026-08-06T11:59:00.000Z'),
      },
    ]);

    await expect(expireAuthorizedPortfolioShares(now)).resolves.toEqual({ count: 1 });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['share-a'] },
        status: 'ACTIVE',
        authorityExpiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    expect(mocks.createEvents).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyAccountId: 'company-a',
          entityId: 'share-a',
          propertyId: 'property-a',
          idempotencyKey: 'authorized-pool-expired:share-a',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not create a second event when no active due share remains', async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(
      expireAuthorizedPortfolioShares(new Date('2026-08-06T12:00:00.000Z'))
    ).resolves.toEqual({ count: 0 });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createEvents).not.toHaveBeenCalled();
  });

  it('scopes contact-request idempotency keys to the requesting tenant', async () => {
    mocks.requestFindUnique.mockResolvedValue({
      id: 'request-a',
      requesterCompanyAccountId: 'company-a',
      shareId: 'share-a',
      message: null,
      idempotencyKey: 'request-key-a',
    });

    await expect(
      requestAuthorizedPoolContact({
        requesterCompanyAccountId: 'company-a',
        shareId: 'share-a',
        idempotencyKey: 'request-key-a',
        principal: { type: 'OWNER', id: 'company-a' },
        now: new Date('2026-08-06T12:00:00.000Z'),
      })
    ).resolves.toMatchObject({ id: 'request-a' });

    expect(mocks.requestFindUnique).toHaveBeenCalledWith({
      where: {
        requesterCompanyAccountId_idempotencyKey: {
          requesterCompanyAccountId: 'company-a',
          idempotencyKey: 'request-key-a',
        },
      },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });

  it('rejects reusing an idempotency key for another share', async () => {
    mocks.requestFindUnique.mockResolvedValue({
      id: 'request-a',
      requesterCompanyAccountId: 'company-a',
      shareId: 'share-b',
      message: null,
      idempotencyKey: 'request-key-a',
    });

    await expect(
      requestAuthorizedPoolContact({
        requesterCompanyAccountId: 'company-a',
        shareId: 'share-a',
        idempotencyKey: 'request-key-a',
        principal: { type: 'OWNER', id: 'company-a' },
        now: new Date('2026-08-06T12:00:00.000Z'),
      })
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('does not overwrite or re-audit a contact decision won by another worker', async () => {
    const decidedAt = new Date('2026-08-06T12:00:00.000Z');
    mocks.requestFindFirst.mockResolvedValue({
      id: 'request-a',
      ownerCompanyAccountId: 'company-owner',
      status: 'PENDING',
    });
    mocks.requestUpdateMany.mockResolvedValue({ count: 0 });
    mocks.requestFindFirstOrThrow.mockResolvedValue({
      id: 'request-a',
      ownerCompanyAccountId: 'company-owner',
      status: 'APPROVED',
    });

    await expect(
      decideAuthorizedPoolContact({
        ownerCompanyAccountId: 'company-owner',
        requestId: 'request-a',
        decision: 'REJECTED',
        principal: { type: 'OWNER', id: 'company-owner' },
        now: decidedAt,
      })
    ).resolves.toMatchObject({ status: 'APPROVED' });

    expect(mocks.requestUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'request-a',
        ownerCompanyAccountId: 'company-owner',
        status: 'PENDING',
      },
      data: expect.objectContaining({ status: 'REJECTED', decidedAt }),
    });
    expect(mocks.appendManagerAudit).not.toHaveBeenCalled();
  });
});
