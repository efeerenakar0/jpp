import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  propertyFindFirst: vi.fn(),
  propertyUpdate: vi.fn(),
  propertyUpdateMany: vi.fn(),
  propertyFindMany: vi.fn(),
  contactFindFirst: vi.fn(),
  contactFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  memberFindMany: vi.fn(),
  mediaFindFirst: vi.fn(),
  mediaUpdateMany: vi.fn(),
  mediaUpdate: vi.fn(),
  mediaCreate: vi.fn(),
  activityCreate: vi.fn(),
  activityFindMany: vi.fn(),
  auditCreate: vi.fn(),
  eventFindUnique: vi.fn(),
  eventCreate: vi.fn(),
  dealFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  matchFindMany: vi.fn(),
  accountFindUniqueOrThrow: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  FabrikaForbiddenError: class FabrikaForbiddenError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/fabrika-workspace-sync', () => ({
  syncLegacyModulesToWorkspace: vi.fn(),
}));

vi.mock('@/lib/company-members', () => ({
  CompanyMemberValidationError: class CompanyMemberValidationError extends Error {
    statusCode = 400;
  },
  companyMemberOperationalFieldsSchema: { shape: {} },
  createCompanyMemberAccount: vi.fn(),
  resetCompanyMemberCredentials: vi.fn(),
  setCompanyMemberActive: vi.fn(),
  updateCompanyMemberProfile: vi.fn(),
}));

vi.mock('@/lib/crm-intelligence', () => ({ calculateCrmScore: vi.fn() }));

vi.mock('@/lib/prisma', () => {
  const client = {
    companyAccount: {
      findUniqueOrThrow: mocks.accountFindUniqueOrThrow,
    },
    companyMember: {
      findFirst: mocks.memberFindFirst,
      findMany: mocks.memberFindMany,
    },
    crmContact: {
      findFirst: mocks.contactFindFirst,
      findMany: mocks.contactFindMany,
    },
    crmProperty: {
      findFirst: mocks.propertyFindFirst,
      findMany: mocks.propertyFindMany,
      update: mocks.propertyUpdate,
      updateMany: mocks.propertyUpdateMany,
    },
    crmPropertyMedia: {
      findFirst: mocks.mediaFindFirst,
      updateMany: mocks.mediaUpdateMany,
      update: mocks.mediaUpdate,
      create: mocks.mediaCreate,
    },
    crmActivity: {
      create: mocks.activityCreate,
      findMany: mocks.activityFindMany,
    },
    managerAuditLog: { create: mocks.auditCreate },
    operationEvent: {
      findUnique: mocks.eventFindUnique,
      create: mocks.eventCreate,
    },
    crmDeal: { findMany: mocks.dealFindMany },
    crmTask: { findMany: mocks.taskFindMany },
    crmMatch: { findMany: mocks.matchFindMany },
    $transaction: mocks.transaction,
  };
  return { default: client };
});

import { POST } from './route';

function request(overrides: Record<string, unknown> = {}) {
  return new Request('https://app.test/api/fabrika/workspace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'update-property',
      id: 'property-a',
      title: 'Güncellenen deniz manzaralı daire',
      referenceCode: 'P-104',
      location: 'Antalya / Alanya / Oba',
      price: 6_500_000,
      roomCount: '3+1',
      area: 150,
      listingType: 'RENT',
      status: 'DRAFT',
      description: 'Yeni açıklama',
      imageUrl: 'https://cdn.example.test/property-a-new.jpg',
      ownerContactId: 'contact-a',
      assignedMemberId: 'member-a',
      ...overrides,
    }),
  });
}

describe('POST /api/fabrika/workspace update-property', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
      permissions: {
        canManageTeam: true,
        canManageSecrets: true,
        canViewSubscription: true,
        canEditReports: true,
      },
    });
    mocks.propertyFindFirst.mockResolvedValue({
      id: 'property-a',
      title: 'Eski başlık',
      imageUrl: 'https://cdn.example.test/property-a-old.jpg',
      status: 'DRAFT',
    });
    mocks.contactFindFirst.mockResolvedValue({ id: 'contact-a' });
    mocks.memberFindFirst.mockResolvedValue({ id: 'member-a' });
    mocks.propertyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mediaFindFirst.mockResolvedValue(null);
    mocks.mediaUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mediaCreate.mockResolvedValue({ id: 'media-new' });
    mocks.activityCreate.mockResolvedValue({ id: 'activity-a' });
    mocks.auditCreate.mockResolvedValue({ id: 'audit-a' });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        crmProperty: {
          findFirst: mocks.propertyFindFirst,
          update: mocks.propertyUpdate,
          updateMany: mocks.propertyUpdateMany,
        },
        crmPropertyMedia: {
          findFirst: mocks.mediaFindFirst,
          updateMany: mocks.mediaUpdateMany,
          update: mocks.mediaUpdate,
          create: mocks.mediaCreate,
        },
        crmActivity: { create: mocks.activityCreate },
        managerAuditLog: { create: mocks.auditCreate },
        operationEvent: {
          findUnique: mocks.eventFindUnique,
          create: mocks.eventCreate,
        },
      })
    );
    mocks.accountFindUniqueOrThrow.mockResolvedValue({
      id: 'company-a',
      companyName: 'Akar Group',
      brandLogoData: null,
      ownerName: 'Efe',
      ownerEmail: null,
      slug: 'akar',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: null,
      workspaceEnabled: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    mocks.memberFindMany.mockResolvedValue([]);
    mocks.contactFindMany.mockResolvedValue([]);
    mocks.propertyFindMany.mockResolvedValue([]);
    mocks.dealFindMany.mockResolvedValue([]);
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.matchFindMany.mockResolvedValue([]);
    mocks.activityFindMany.mockResolvedValue([]);
  });

  it('updates only the authenticated tenant property and records the new cover atomically', async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.propertyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-a', companyAccountId: 'company-a' },
      })
    );
    expect(mocks.propertyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-a', companyAccountId: 'company-a' },
        data: expect.objectContaining({
          title: 'Güncellenen deniz manzaralı daire',
          listingType: 'RENT',
          ownerContactId: 'contact-a',
          assignedMemberId: 'member-a',
        }),
      })
    );
    expect(mocks.mediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyAccountId: 'company-a',
          propertyId: 'property-a',
          isCover: true,
        }),
      })
    );
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
  });

  it('does not let the generic edit action bypass the publication state machine', async () => {
    const response = await POST(request({ status: 'ACTIVE' }));

    expect(response.status).toBe(409);
    expect(mocks.propertyUpdateMany).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('yayına al'),
    });
  });

  it('does not mutate a property that cannot be resolved inside the tenant', async () => {
    mocks.propertyFindFirst.mockResolvedValueOnce(null);

    const response = await POST(request({ id: 'property-other-company' }));

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.propertyUpdateMany).not.toHaveBeenCalled();
  });

  it('doğrulaması eşleşmeyen yayın isteğini kullanıcıya hata vermeden beklemeye alır', async () => {
    mocks.eventFindUnique.mockResolvedValue(null);
    mocks.propertyFindFirst.mockResolvedValue({
      id: 'property-a',
      title: 'Doğrulama bekleyen portföy',
      status: 'DRAFT',
      publicationApprovedAt: null,
      authorityDocumentVerifiedAt: null,
      authorityExpiresAt: null,
      eidsRequired: true,
      eidsVerifiedAt: null,
      eidsVerificationReference: null,
      eidsExemptionReason: null,
      publicationBlockedAt: null,
    });

    const response = await POST(
      request({
        action: 'set-property-status',
        status: 'ACTIVE',
        idempotencyKey: 'property-status:pending-verification',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      publicationPending: true,
    });
    expect(mocks.propertyUpdate).not.toHaveBeenCalled();
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
