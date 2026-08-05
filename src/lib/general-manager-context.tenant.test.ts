import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  appointmentCount: vi.fn(),
  conversationCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const count = () => vi.fn().mockResolvedValue(0);
  const findMany = () => vi.fn().mockResolvedValue([]);
  return {
    default: {
      project: { count: count() },
      huntedListing: { count: count() },
      appointmentRequest: { count: mocks.appointmentCount },
      customerConversation: { count: mocks.conversationCount },
      notification: { count: count(), findMany: findMany() },
      crmContact: { count: count(), findMany: findMany() },
      crmProperty: { count: count(), findMany: findMany() },
      crmDeal: { count: count(), findMany: findMany() },
      crmTask: { count: count(), findMany: findMany() },
      crmMatch: { findMany: findMany() },
      crmActivity: { findMany: findMany() },
      adCampaign: { findMany: findMany() },
      marketingWebsiteAnalysis: { findMany: findMany() },
      googleCalendarConnection: { findUnique: vi.fn().mockResolvedValue(null) },
      operationEvent: { findMany: findMany() },
      managerAuditLog: { findMany: findMany() },
      whatsAppOutboxMessage: { findMany: findMany() },
      managerPolicy: { findMany: findMany() },
    },
  };
});

import { getGeneralManagerContext } from './general-manager-context';

describe('getGeneralManagerContext tenant metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appointmentCount.mockResolvedValue(3);
    mocks.conversationCount.mockResolvedValue(5);
  });

  it('counts pending appointments and active conversations for non-Jasmine tenants', async () => {
    const result = await getGeneralManagerContext({
      accountId: 'company-other',
      accountSlug: 'other-realty',
      companyName: 'Other Realty',
      displayName: 'Owner',
      type: 'OWNER',
      memberId: null,
    });

    expect(result.metrics.pendingAppointments).toBe(3);
    expect(result.metrics.activeConversations).toBe(5);
    expect(mocks.appointmentCount).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        conversation: { companyAccountId: 'company-other' },
      },
    });
    expect(mocks.conversationCount).toHaveBeenCalledWith({
      where: { companyAccountId: 'company-other', isActive: true },
    });
  });
});
