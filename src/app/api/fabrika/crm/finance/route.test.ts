import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  contactFindFirst: vi.fn(),
  dealFindFirst: vi.fn(),
  propertyFindFirst: vi.fn(),
  activityFindFirst: vi.fn(),
  activityCreate: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmContact: { findFirst: mocks.contactFindFirst },
    crmDeal: { findFirst: mocks.dealFindFirst },
    crmProperty: { findFirst: mocks.propertyFindFirst },
    crmActivity: {
      findFirst: mocks.activityFindFirst,
      create: mocks.activityCreate,
    },
  },
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('https://app.test/api/fabrika/crm/finance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fabrika/crm/finance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    mocks.contactFindFirst.mockResolvedValue({ id: 'contact-a', name: 'Ada Müşteri' });
    mocks.dealFindFirst.mockResolvedValue({ id: 'deal-a' });
    mocks.propertyFindFirst.mockResolvedValue({ id: 'property-a' });
    mocks.activityCreate.mockResolvedValue({
      id: 'activity-a',
      createdAt: new Date('2026-08-19T12:00:00.000Z'),
    });
  });

  it('records a tenant-scoped customer payment with an audit-friendly metadata payload', async () => {
    const response = await POST(request({
      action: 'create-entry',
      contactId: 'contact-a',
      dealId: 'deal-a',
      propertyId: 'property-a',
      kind: 'PAYMENT',
      status: 'PAID',
      amount: 125_000,
      currency: 'TRY',
      occurredAt: '2026-08-19T12:00:00.000Z',
      dueAt: null,
      method: 'Havale / EFT',
      reference: 'TRX-1042',
      description: 'Kapora tahsilatı',
    }));

    expect(response.status).toBe(200);
    expect(mocks.contactFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contact-a', companyAccountId: 'company-a' },
    }));
    expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        contactId: 'contact-a',
        actorMemberId: 'member-a',
        type: 'CRM_FINANCE_ENTRY',
        title: 'Tahsilat',
        metadata: expect.stringContaining('"amount":125000'),
      }),
    }));
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it('rejects a contact outside the authenticated company', async () => {
    mocks.contactFindFirst.mockResolvedValue(null);

    const response = await POST(request({
      action: 'create-entry',
      contactId: 'other-company-contact',
      kind: 'DEBIT',
      status: 'PLANNED',
      amount: 50_000,
      currency: 'TRY',
      occurredAt: '2026-08-19T12:00:00.000Z',
    }));

    expect(response.status).toBe(404);
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it('reverses a finance record by appending an immutable audit event', async () => {
    mocks.activityFindFirst
      .mockResolvedValueOnce({
        id: 'entry-a',
        contactId: 'contact-a',
        propertyId: null,
        dealId: null,
      })
      .mockResolvedValueOnce(null);

    const response = await POST(request({
      action: 'reverse-entry',
      activityId: 'entry-a',
      reason: 'Mükerrer tahsilat',
    }));

    expect(response.status).toBe(200);
    expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'CRM_FINANCE_REVERSAL',
        metadata: expect.stringContaining('"reversesActivityId":"entry-a"'),
      }),
    }));
  });
});
