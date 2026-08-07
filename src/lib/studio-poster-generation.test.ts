import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCount: vi.fn(),
  attemptCreate: vi.fn(),
  attemptUpdateMany: vi.fn(),
  generationFindFirst: vi.fn(),
  generationCreate: vi.fn(),
  generationUpdate: vi.fn(),
  eventUpsert: vi.fn(),
  auditCreate: vi.fn(),
  propertyFindFirst: vi.fn(),
  memberFindFirst: vi.fn(),
}));

const transactionClient = {
  studioPosterGenerationAttempt: {
    findFirst: mocks.attemptFindFirst,
    count: mocks.attemptCount,
    create: mocks.attemptCreate,
    updateMany: mocks.attemptUpdateMany,
  },
  studioPosterGeneration: {
    findFirst: mocks.generationFindFirst,
    create: mocks.generationCreate,
    update: mocks.generationUpdate,
  },
  operationEvent: { upsert: mocks.eventUpsert },
  managerAuditLog: { create: mocks.auditCreate },
  crmProperty: { findFirst: mocks.propertyFindFirst },
  companyMember: { findFirst: mocks.memberFindFirst },
};

vi.mock('@/lib/prisma', () => ({
  default: { $transaction: mocks.transaction },
}));

import {
  completeStudioPosterGenerationAttempt,
  failStudioPosterGenerationAttempt,
  reserveStudioPosterGeneration,
} from './studio-poster-generation';

const now = new Date('2026-08-06T10:00:00.000Z');

function generation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'poster-generation-a',
    companyAccountId: 'company-a',
    propertyId: 'property-a',
    createdByMemberId: 'member-a',
    logicalFingerprint: 'logical-a',
    initialRequestKey: 'initial-request-a',
    regenerationCount: 0,
    maxRegenerations: 2,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'poster-attempt-a',
    companyAccountId: 'company-a',
    generationId: 'poster-generation-a',
    idempotencyKey: 'request-0000000001',
    kind: 'INITIAL',
    sequence: 0,
    status: 'PROCESSING',
    requestFingerprint: 'request-fingerprint-a',
    resultDigest: null,
    failureCode: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('studio poster generation limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    );
    mocks.attemptFindFirst.mockResolvedValue(null);
    mocks.attemptCount.mockResolvedValue(0);
    mocks.attemptCreate.mockImplementation(async ({ data }) => attempt(data));
    mocks.generationFindFirst.mockResolvedValue(null);
    mocks.generationCreate.mockImplementation(async ({ data }) => generation(data));
    mocks.generationUpdate.mockImplementation(async ({ data }) =>
      generation({ version: 1, ...data })
    );
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-a' });
    mocks.auditCreate.mockResolvedValue({ id: 'audit-a' });
    mocks.propertyFindFirst.mockResolvedValue({ id: 'property-a' });
    mocks.memberFindFirst.mockResolvedValue({ id: 'member-a' });
  });

  it('reserves one tenant-scoped initial attempt without spending a regeneration', async () => {
    const result = await reserveStudioPosterGeneration({
      companyAccountId: 'company-a',
      memberId: 'member-a',
      propertyId: 'property-a',
      action: 'INITIAL',
      logicalFingerprint: 'logical-a',
      requestFingerprint: 'request-fingerprint-a',
      idempotencyKey: 'request-0000000001',
      now,
    });

    expect(result.duplicate).toBe(false);
    expect(result.generation.regenerationCount).toBe(0);
    expect(mocks.generationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        logicalFingerprint: 'logical-a',
        maxRegenerations: 2,
      }),
    });
    expect(mocks.attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        kind: 'INITIAL',
        sequence: 0,
      }),
    });
  });

  it('rejects a property from another tenant before reserving a paid generation', async () => {
    mocks.propertyFindFirst.mockResolvedValue(null);

    await expect(
      reserveStudioPosterGeneration({
        companyAccountId: 'company-a',
        memberId: 'member-a',
        propertyId: 'property-foreign',
        action: 'INITIAL',
        logicalFingerprint: 'logical-foreign',
        requestFingerprint: 'request-fingerprint-foreign',
        idempotencyKey: 'request-0000000010',
        now,
      })
    ).rejects.toMatchObject({
      code: 'PROPERTY_FORBIDDEN',
      status: 403,
    });
    expect(mocks.generationCreate).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it('does not allow a fresh initial request to bypass the same logical poster limit', async () => {
    mocks.generationFindFirst.mockResolvedValue(generation());
    mocks.attemptFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(attempt({ status: 'SUCCEEDED' }));

    await expect(
      reserveStudioPosterGeneration({
        companyAccountId: 'company-a',
        memberId: 'member-a',
        propertyId: 'property-a',
        action: 'INITIAL',
        logicalFingerprint: 'logical-a',
        requestFingerprint: 'request-fingerprint-bypass',
        idempotencyKey: 'request-0000000006',
        now,
      })
    ).rejects.toMatchObject({
      code: 'POSTER_ALREADY_CREATED',
      status: 409,
    });
    expect(mocks.generationCreate).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it('retries a failed initial provider attempt without spending a regeneration right', async () => {
    mocks.generationFindFirst.mockResolvedValue(generation());
    mocks.attemptFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(attempt({ status: 'FAILED' }));
    mocks.attemptCount.mockResolvedValue(1);

    const result = await reserveStudioPosterGeneration({
      companyAccountId: 'company-a',
      memberId: 'member-a',
      propertyId: 'property-a',
      action: 'INITIAL',
      logicalFingerprint: 'logical-a',
      requestFingerprint: 'request-fingerprint-retry',
      idempotencyKey: 'request-0000000011',
      now,
    });

    expect(result.duplicate).toBe(false);
    expect(result.generation.regenerationCount).toBe(0);
    expect(mocks.generationCreate).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generationId: 'poster-generation-a',
        kind: 'INITIAL_RETRY',
        sequence: 1,
      }),
    });
  });

  it('returns the existing attempt idempotently instead of reserving or charging twice', async () => {
    mocks.attemptFindFirst.mockResolvedValue({
      ...attempt({ status: 'SUCCEEDED' }),
      generation: generation({ regenerationCount: 1 }),
    });

    const result = await reserveStudioPosterGeneration({
      companyAccountId: 'company-a',
      memberId: null,
      propertyId: 'property-a',
      action: 'REGENERATE',
      generationId: 'poster-generation-a',
      logicalFingerprint: 'logical-a',
      requestFingerprint: 'request-fingerprint-a',
      idempotencyKey: 'request-0000000001',
      now,
    });

    expect(result.duplicate).toBe(true);
    expect(result.attempt.status).toBe('SUCCEEDED');
    expect(mocks.generationFindFirst).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it('rejects another tenant generation before an attempt is created', async () => {
    mocks.generationFindFirst.mockResolvedValue(null);

    await expect(
      reserveStudioPosterGeneration({
        companyAccountId: 'company-a',
        memberId: null,
        propertyId: 'property-a',
        action: 'REGENERATE',
        generationId: 'foreign-generation',
        logicalFingerprint: 'logical-a',
        requestFingerprint: 'request-fingerprint-a',
        idempotencyKey: 'request-0000000002',
        now,
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it('allows at most two successful or in-flight regenerations', async () => {
    mocks.generationFindFirst.mockResolvedValue(
      generation({ regenerationCount: 2 })
    );
    mocks.attemptCount.mockResolvedValue(2);

    await expect(
      reserveStudioPosterGeneration({
        companyAccountId: 'company-a',
        memberId: 'member-a',
        propertyId: 'property-a',
        action: 'REGENERATE',
        generationId: 'poster-generation-a',
        logicalFingerprint: 'logical-a',
        requestFingerprint: 'request-fingerprint-b',
        idempotencyKey: 'request-0000000003',
        now,
      })
    ).rejects.toMatchObject({
      code: 'REGENERATION_LIMIT_REACHED',
      status: 409,
    });
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });

  it('uses a new sequence after a failed attempt while keeping the right available', async () => {
    mocks.generationFindFirst.mockResolvedValue(generation());
    mocks.attemptCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(4);

    await reserveStudioPosterGeneration({
      companyAccountId: 'company-a',
      memberId: 'member-a',
      propertyId: 'property-a',
      action: 'REGENERATE',
      generationId: 'poster-generation-a',
      logicalFingerprint: 'logical-a',
      requestFingerprint: 'request-fingerprint-retry',
      idempotencyKey: 'request-0000000005',
      now,
    });

    expect(mocks.attemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'REGENERATION',
        sequence: 4,
      }),
    });
  });

  it('increments the persisted counter only after a regeneration succeeds', async () => {
    mocks.attemptFindFirst.mockResolvedValue({
      ...attempt({ kind: 'REGENERATION', sequence: 1 }),
      generation: generation(),
    });
    mocks.generationUpdate.mockResolvedValue(
      generation({ regenerationCount: 1, version: 2 })
    );

    const result = await completeStudioPosterGenerationAttempt({
      companyAccountId: 'company-a',
      attemptId: 'poster-attempt-a',
      resultDigest: 'sha256-result-a',
      now,
    });

    expect(mocks.generationUpdate).toHaveBeenCalledWith({
      where: { id: 'poster-generation-a' },
      data: { regenerationCount: { increment: 1 } },
    });
    expect(result.regenerationCount).toBe(1);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        operation: 'STUDIO_POSTER_REGENERATION_COMPLETED',
        result: 'SUCCEEDED',
      }),
    });
  });

  it('marks provider failures without consuming a regeneration right', async () => {
    mocks.attemptFindFirst.mockResolvedValue({
      ...attempt({ kind: 'REGENERATION', sequence: 1 }),
      generation: generation(),
    });

    await failStudioPosterGenerationAttempt({
      companyAccountId: 'company-a',
      attemptId: 'poster-attempt-a',
      failureCode: 'PROVIDER_BUSY',
      now,
    });

    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'poster-attempt-a',
        companyAccountId: 'company-a',
        status: 'PROCESSING',
      },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
    expect(mocks.generationUpdate).not.toHaveBeenCalled();
  });
});
