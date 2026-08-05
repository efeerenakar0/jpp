import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  findAppointments: vi.fn(),
  updateAppointment: vi.fn(),
  updateConversation: vi.fn(),
  sendMessage: vi.fn(),
  saveMessage: vi.fn(),
  createNotification: vi.fn(),
  processLifecycle: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    appointmentRequest: {
      findMany: mocks.findAppointments,
      updateMany: mocks.updateAppointment,
    },
    customerConversation: { update: mocks.updateConversation },
    $transaction: vi.fn(
      async (
        callback: (tx: {
          appointmentRequest: { updateMany: typeof mocks.updateAppointment };
          customerConversation: { update: typeof mocks.updateConversation };
        }) => unknown
      ) =>
        callback({
          appointmentRequest: { updateMany: mocks.updateAppointment },
          customerConversation: { update: mocks.updateConversation },
        })
    ),
  },
}));

vi.mock('@/lib/assistant-messaging', () => ({
  sendAssistantWhatsAppMessage: mocks.sendMessage,
  saveOutgoingConversationMessage: mocks.saveMessage,
}));

vi.mock('@/lib/fabrika-notifications', () => ({
  createCompanyNotification: mocks.createNotification,
}));

vi.mock('@/lib/viewing-workflow/lifecycle', () => ({
  processAppointmentLifecycle: mocks.processLifecycle,
}));

import { GET } from './route';

const appointment = {
  id: 'appointment-a',
  status: 'APPROVED',
  customerName: 'Ayşe',
  customerPhone: '+905551112233',
  conversationId: 'conversation-a',
  proposedDate: null,
  proposedTime: null,
  startAt: new Date('2026-08-05T09:00:00.000Z'),
  timezone: 'Europe/Istanbul',
  companyAccount: {
    companyName: 'Akar Group',
    onboardingState: null,
  },
  conversation: {
    companyAccountId: 'company-a',
    lastCustomerMessageAt: new Date('2026-08-04T08:00:00.000Z'),
  },
};

function cronRequest() {
  return new Request('https://example.test/api/cron/appointment-reminders', {
    headers: { authorization: 'Bearer cron-test' },
  });
}

function delivery(deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED') {
  return {
    providerMessageId: 'provider-a',
    deliveryStatus,
    messageType: 'TEXT' as const,
    metadata: '{}',
  };
}

describe('appointment reminder persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T09:00:00.000Z'));
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-test';
    mocks.findAppointments.mockResolvedValue([appointment]);
    mocks.updateAppointment.mockResolvedValue({ count: 1 });
    mocks.updateConversation.mockResolvedValue(appointment.conversation);
    mocks.saveMessage.mockResolvedValue({ id: 'message-a' });
    mocks.createNotification.mockResolvedValue({ id: 'notification-a' });
    mocks.processLifecycle.mockResolvedValue([]);
  });

  it('keeps a queued reminder retryable without marking it sent', async () => {
    mocks.sendMessage.mockResolvedValue(delivery('QUEUED'));

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body).toMatchObject({ sent: 0, pending: 1, failed: 0 });
    expect(mocks.updateAppointment).not.toHaveBeenCalled();
    expect(mocks.updateConversation).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it('does not mark a failed reminder sent and records an actionable failure', async () => {
    mocks.sendMessage.mockResolvedValue(delivery('FAILED'));

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body).toMatchObject({ sent: 0, pending: 0, failed: 1 });
    expect(mocks.updateAppointment).not.toHaveBeenCalled();
    expect(mocks.updateConversation).not.toHaveBeenCalled();
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it('advances exactly once after the same idempotent reminder becomes sent', async () => {
    mocks.sendMessage
      .mockResolvedValueOnce(delivery('QUEUED'))
      .mockResolvedValueOnce(delivery('SENT'));

    await GET(cronRequest());
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body).toMatchObject({ sent: 1, pending: 0, failed: 0 });
    expect(mocks.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        idempotencyKey: 'appointment:appointment-a:customer-reminder',
      })
    );
    expect(mocks.updateAppointment).toHaveBeenCalledTimes(1);
    expect(mocks.updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appointment-a', customerReminderSentAt: null },
        data: expect.objectContaining({
          customerReminderSentAt: new Date('2026-08-04T09:00:00.000Z'),
        }),
      })
    );
  });

  it('uses the tenant reminder window instead of a global 26 hour horizon', async () => {
    mocks.findAppointments.mockResolvedValue([
      {
        ...appointment,
        startAt: new Date('2026-08-05T21:00:00.000Z'),
        companyAccount: {
          companyName: 'Akar Group',
          onboardingState: {
            operations: { appointmentReminderHours: 36 },
          },
        },
      },
    ]);
    mocks.sendMessage.mockResolvedValue(delivery('SENT'));

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body).toMatchObject({ due: 1, sent: 1 });
  });
});
