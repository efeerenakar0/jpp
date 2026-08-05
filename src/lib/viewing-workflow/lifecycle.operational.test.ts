import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  const tx = {
    companyAccount: { findUnique: vi.fn() },
    notification: { upsert: vi.fn() },
    whatsAppInteractionPrompt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    viewingAssignmentAttempt: { findFirst: vi.fn() },
    viewingWorkflow: { updateMany: vi.fn() },
    appointmentRequest: { update: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    findAppointments: vi.fn(),
    findDuePrompts: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    dispatchOutboxes: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    appointmentRequest: { findMany: mocks.findAppointments },
    whatsAppInteractionPrompt: { findMany: mocks.findDuePrompts },
    $transaction: mocks.transaction,
  },
}));

vi.mock('./service', () => ({
  dispatchOutboxes: mocks.dispatchOutboxes,
  ownerDecisionPrompt: vi.fn(),
  ownerRecipient: vi.fn(),
}));

vi.mock('./outbox', () => ({
  createWorkflowOutboxInTransaction: vi.fn(),
}));

import { processAppointmentLifecycle } from './lifecycle';

describe('appointment lifecycle operational account guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findDuePrompts.mockResolvedValue([]);
    mocks.dispatchOutboxes.mockResolvedValue(undefined);
    mocks.tx.companyAccount.findUnique.mockResolvedValue({
      status: 'SUSPENDED',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: null,
      workspaceEnabled: true,
    });
  });

  it('does not create prompts or advance workflow state for a suspended tenant', async () => {
    mocks.findAppointments.mockResolvedValue([
      {
        id: 'appointment-a',
        companyAccountId: 'company-a',
        conversationId: 'conversation-a',
        shortCode: 'R3M8',
        timezone: 'Europe/Istanbul',
        startAt: new Date('2026-08-05T11:00:00.000Z'),
        endAt: new Date('2026-08-05T12:00:00.000Z'),
        employeeReminderSentAt: null,
        outcomePromptSentAt: null,
        outcome: null,
        companyAccount: {
          companyName: 'Akar Group',
          onboardingState: null,
        },
        assignedMember: {
          id: 'member-a',
          name: 'Zeynep',
          phoneNormalized: '+905551112233',
        },
        viewingWorkflow: {
          id: 'workflow-a',
          companyAccountId: 'company-a',
          crmTaskId: 'task-a',
          contactId: 'contact-a',
          propertyId: 'property-a',
          contact: { name: 'Mehmet' },
          property: { title: 'Daire', referenceCode: 'P-104' },
        },
      },
    ]);

    const result = await processAppointmentLifecycle(
      new Date('2026-08-04T11:00:00.000Z')
    );

    expect(result).toEqual([
      {
        appointmentId: 'appointment-a',
        action: 'SKIPPED_ACCOUNT_INACTIVE',
      },
    ]);
    expect(mocks.tx.whatsAppInteractionPrompt.create).not.toHaveBeenCalled();
    expect(mocks.tx.viewingWorkflow.updateMany).not.toHaveBeenCalled();
  });

  it('does not expire an existing due prompt for a suspended tenant', async () => {
    mocks.findAppointments.mockResolvedValue([]);
    mocks.findDuePrompts.mockResolvedValue([
      {
        id: 'prompt-a',
        companyAccountId: 'company-a',
        appointmentRequestId: 'appointment-a',
      },
    ]);

    const result = await processAppointmentLifecycle(
      new Date('2026-08-04T11:00:00.000Z')
    );

    expect(result).toEqual([
      {
        appointmentId: 'appointment-a',
        action: 'SKIPPED_ACCOUNT_INACTIVE',
      },
    ]);
    expect(mocks.tx.whatsAppInteractionPrompt.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.whatsAppInteractionPrompt.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.appointmentRequest.update).not.toHaveBeenCalled();
  });
});
