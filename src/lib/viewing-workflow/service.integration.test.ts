import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  const tx = {
    appointmentOutcome: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    appointmentRequest: { updateMany: vi.fn() },
    companyAccount: { findFirst: vi.fn(), findUnique: vi.fn() },
    companySettings: { findUnique: vi.fn() },
    companyMember: { findFirst: vi.fn(), findMany: vi.fn() },
    crmActivity: { create: vi.fn() },
    crmDeal: { updateMany: vi.fn() },
    crmProperty: { updateMany: vi.fn() },
    crmTask: { findFirst: vi.fn() },
    managerNotificationPreference: { findUnique: vi.fn() },
    notification: { upsert: vi.fn() },
    viewingAssignmentAttempt: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    viewingWorkflow: {
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    whatsAppConfig: { findUnique: vi.fn() },
    whatsAppInteractionPrompt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return {
    tx,
    findAssignmentAttempts: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    recordOperationEvent: vi.fn(),
    transitionTask: vi.fn(),
    createOutbox: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: mocks.transaction,
    viewingAssignmentAttempt: { findMany: mocks.findAssignmentAttempts },
    whatsAppInteractionPrompt: mocks.tx.whatsAppInteractionPrompt,
  },
}));

vi.mock('@/lib/digital-manager/events', () => ({
  recordOperationEvent: mocks.recordOperationEvent,
}));

vi.mock('@/lib/digital-manager/tasks', () => ({
  transitionTaskInTransaction: mocks.transitionTask,
}));

vi.mock('@/lib/property-publication', () => ({
  publicationEligibility: vi.fn(() => ({ eligible: true, reasons: [] })),
}));

vi.mock('@/lib/company-whatsapp', () => ({
  dispatchWhatsAppOutboxMessage: vi.fn(),
}));

vi.mock('./outbox', () => ({
  createWorkflowOutboxInTransaction: mocks.createOutbox,
}));

import {
  applyViewingDeliveryTransitionInTransaction,
  processDueViewingAcknowledgementReminders,
  processDueViewingAcknowledgements,
  processViewingInteractionReply,
  processViewingPanelDecision,
} from './service';

const now = new Date('2026-08-02T12:00:00.000Z');

function loadedPrompt(
  expectedResponseType:
    | 'APPOINTMENT_CONFIRMATION'
    | 'APPOINTMENT_OUTCOME'
    | 'SALE_DECISION'
) {
  return {
    id: `prompt-${expectedResponseType}`,
    companyAccountId: 'company-a',
    workflowId: 'workflow-a',
    taskId: 'task-a',
    propertyId: 'property-a',
    contactId: 'contact-a',
    appointmentRequestId: 'appointment-a',
    assignmentAttemptId: 'attempt-a',
    actionId:
      expectedResponseType === 'SALE_DECISION' ? 'outcome-a' : null,
    recipientType:
      expectedResponseType === 'SALE_DECISION' ? 'OWNER' : 'EMPLOYEE',
    recipientId:
      expectedResponseType === 'SALE_DECISION' ? 'company-a' : 'member-a',
    recipientMemberId:
      expectedResponseType === 'SALE_DECISION' ? null : 'member-a',
    promptType:
      expectedResponseType === 'APPOINTMENT_CONFIRMATION'
        ? 'EMPLOYEE_APPOINTMENT_CONFIRMATION'
        : expectedResponseType === 'APPOINTMENT_OUTCOME'
          ? 'EMPLOYEE_APPOINTMENT_OUTCOME'
          : 'OWNER_SALE_DECISION',
    expectedResponseType,
    shortCode: expectedResponseType === 'SALE_DECISION' ? 'S9P2' : 'R3M8',
    candidateMemberSnapshot: null,
    sentProviderMessageId: 'provider-out-1',
    lastReplyProviderMessageId: null,
    status: 'OPEN',
    reminderCount: 0,
    deadlineAt: new Date('2026-08-02T12:15:00.000Z'),
    expiresAt: new Date('2026-08-04T12:00:00.000Z'),
    answeredAt: null,
    outboxMessageId: null,
    idempotencyKey: `prompt:${expectedResponseType}`,
    createdAt: now,
    updatedAt: now,
    workflow: {
      id: 'workflow-a',
      companyAccountId: 'company-a',
      contactId: 'contact-a',
      propertyId: 'property-a',
      conversationId: 'conversation-a',
      crmTaskId: 'task-a',
      dealId: 'deal-a',
      shortCode: 'V7K2',
      status: 'APPOINTMENT_CONFIRMED',
    },
    assignmentAttempt: {
      id: 'attempt-a',
      companyAccountId: 'company-a',
      workflowId: 'workflow-a',
      taskId: 'task-a',
      memberId: 'member-a',
      sequence: 1,
    },
    appointmentRequest: {
      id: 'appointment-a',
      companyAccountId: 'company-a',
      conversationId: 'conversation-a',
      assignedMemberId: 'member-a',
      shortCode: 'R3M8',
      timezone: 'Europe/Istanbul',
      startAt: new Date('2026-08-03T11:00:00.000Z'),
      endAt: new Date('2026-08-03T12:00:00.000Z'),
    },
  };
}

function openSummary(prompt: ReturnType<typeof loadedPrompt>) {
  return {
    id: prompt.id,
    shortCode: prompt.shortCode,
    recipientId: prompt.recipientId,
    expectedResponseType: prompt.expectedResponseType,
    sentProviderMessageId: prompt.sentProviderMessageId,
    status: 'OPEN',
  };
}

describe('viewing workflow deterministic reply mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.companyAccount.findFirst.mockResolvedValue({
      id: 'company-a',
      ownerName: 'Patron',
      ownerPhoneNormalized: null,
    });
    mocks.tx.companyAccount.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: null,
      workspaceEnabled: true,
    });
    mocks.tx.managerNotificationPreference.findUnique.mockResolvedValue(null);
    mocks.tx.whatsAppConfig.findUnique.mockResolvedValue(null);
    mocks.tx.companyMember.findMany.mockResolvedValue([]);
    mocks.tx.companyMember.findFirst.mockResolvedValue(null);
    mocks.tx.companySettings.findUnique.mockResolvedValue(null);
    mocks.tx.whatsAppInteractionPrompt.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.viewingAssignmentAttempt.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.viewingWorkflow.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.appointmentRequest.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.crmProperty.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.crmDeal.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.crmTask.findFirst.mockResolvedValue({
      workflowStatus: 'APPOINTMENT_CONFIRMED',
    });
    mocks.tx.notification.upsert.mockResolvedValue({ id: 'notification-a' });
    mocks.tx.crmActivity.create.mockResolvedValue({ id: 'activity-a' });
  });

  it('çalışan katılamıyorum dediğinde randevuyu teyit edilmiş bırakmaz ve patron kararını açar', async () => {
    const prompt = loadedPrompt('APPOINTMENT_CONFIRMATION');
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst
      .mockResolvedValueOnce(prompt)
      .mockResolvedValueOnce(null);
    mocks.tx.viewingAssignmentAttempt.findFirst.mockResolvedValue({
      id: 'attempt-a',
    });
    mocks.tx.viewingAssignmentAttempt.findFirstOrThrow.mockResolvedValue({
      id: 'attempt-a',
      member: { name: 'Zeynep' },
    });
    mocks.tx.viewingWorkflow.findFirstOrThrow.mockResolvedValue({
      id: 'workflow-a',
      companyAccountId: 'company-a',
      contactId: 'contact-a',
      propertyId: 'property-a',
      conversationId: 'conversation-a',
      crmTaskId: 'task-a',
      dealId: 'deal-a',
      shortCode: 'V7K2',
      contact: { name: 'Mehmet' },
      property: { title: 'Kadıköy Dairesi', referenceCode: 'P-104' },
      crmTask: { id: 'task-a', assignedMemberId: 'member-a' },
      assignmentAttempts: [{ memberId: 'member-a' }],
    });
    mocks.tx.whatsAppInteractionPrompt.upsert.mockResolvedValue({
      id: 'owner-prompt-a',
      outboxMessageId: null,
    });

    const result = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'EMPLOYEE',
      recipientId: 'member-a',
      text: '#R3M8 KATILAMIYORUM: hastayım',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-1',
      receivedAt: now,
    });

    expect(result).toMatchObject({
      handled: true,
      mutated: true,
      action: 'CANNOT_ATTEND',
    });
    expect(mocks.tx.appointmentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyAccountId: 'company-a',
          assignedMemberId: 'member-a',
        }),
        data: expect.objectContaining({ employeeDeclinedAt: now }),
      })
    );
    expect(mocks.tx.whatsAppInteractionPrompt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          promptType: 'OWNER_APPOINTMENT_ESCALATION',
          appointmentRequestId: 'appointment-a',
        }),
      })
    );
  });

  it('satılmadı sonucunu ilişkili kayda yazar, portföyü satıldı yapmaz ve mükerrer sonucu engeller', async () => {
    const prompt = loadedPrompt('APPOINTMENT_OUTCOME');
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst
      .mockResolvedValueOnce(prompt)
      .mockResolvedValueOnce(null);
    mocks.tx.appointmentOutcome.findUnique.mockResolvedValue(null);
    mocks.tx.appointmentOutcome.upsert.mockResolvedValue({ id: 'outcome-a' });

    const result = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'EMPLOYEE',
      recipientId: 'member-a',
      text: '#R3M8 SATILMADI: bütçesine uymadı',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-2',
      receivedAt: now,
    });

    expect(result).toMatchObject({
      handled: true,
      mutated: true,
      action: 'NOT_SOLD',
    });
    expect(mocks.tx.appointmentOutcome.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          companyAccountId: 'company-a',
          appointmentRequestId: 'appointment-a',
          outcome: 'NOT_SOLD',
          noSaleReason: 'PRICE',
          reasonText: 'bütçesine uymadı',
        }),
      })
    );
    expect(mocks.tx.crmProperty.updateMany).not.toHaveBeenCalled();
  });

  it('çalışanın satıldı bildirimi yalnız patron kararını açar ve portföyü değiştirmez', async () => {
    const prompt = loadedPrompt('APPOINTMENT_OUTCOME');
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst
      .mockResolvedValueOnce(prompt)
      .mockResolvedValueOnce(null);
    mocks.tx.appointmentOutcome.findUnique.mockResolvedValue(null);
    mocks.tx.appointmentOutcome.upsert.mockResolvedValue({ id: 'outcome-a' });
    mocks.tx.viewingWorkflow.findFirstOrThrow.mockResolvedValue({
      id: 'workflow-a',
      companyAccountId: 'company-a',
      contactId: 'contact-a',
      propertyId: 'property-a',
      conversationId: 'conversation-a',
      crmTaskId: 'task-a',
      dealId: 'deal-a',
      shortCode: 'V7K2',
      contact: { name: 'Mehmet' },
      property: { title: 'Kadıköy Dairesi', referenceCode: 'P-104' },
      crmTask: { assignedMember: { name: 'Zeynep' } },
    });
    mocks.tx.whatsAppInteractionPrompt.create.mockResolvedValue({
      id: 'sale-prompt-a',
    });

    const result = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'EMPLOYEE',
      recipientId: 'member-a',
      text: '#R3M8 SATILDI',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-sale-report',
      receivedAt: now,
    });

    expect(result).toMatchObject({
      handled: true,
      mutated: true,
      action: 'SALE_REPORTED',
    });
    expect(mocks.tx.appointmentOutcome.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          outcome: 'SOLD_REPORTED',
          saleDecision: 'PENDING',
        }),
      })
    );
    expect(mocks.tx.whatsAppInteractionPrompt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptType: 'OWNER_SALE_DECISION',
          expectedResponseType: 'SALE_DECISION',
        }),
      })
    );
    expect(mocks.tx.crmProperty.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.crmDeal.updateMany).not.toHaveBeenCalled();
  });

  it('patron kaldır kararı vermeden portföyü SOLD yapmaz; kesin promptla bir kez uygular', async () => {
    const prompt = loadedPrompt('SALE_DECISION');
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst
      .mockResolvedValueOnce(prompt)
      .mockResolvedValueOnce(null);
    mocks.tx.appointmentOutcome.findFirst.mockResolvedValue({
      id: 'outcome-a',
      saleDecision: 'PENDING',
    });

    const result = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'OWNER',
      recipientId: 'company-a',
      text: '#S9P2 KALDIR',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-3',
      receivedAt: now,
    });

    expect(result).toMatchObject({
      handled: true,
      mutated: true,
      action: 'PROPERTY_SOLD',
    });
    expect(mocks.tx.crmProperty.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-a',
        companyAccountId: 'company-a',
        status: { in: ['ACTIVE', 'RESERVED'] },
      },
      data: expect.objectContaining({
        status: 'SOLD',
        publicationBlockedAt: now,
      }),
    });
    expect(mocks.tx.crmDeal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'deal-a',
          companyAccountId: 'company-a',
        }),
        data: expect.objectContaining({ stage: 'WON', probability: 100 }),
      })
    );

    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValueOnce(null);
    const duplicate = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'OWNER',
      recipientId: 'company-a',
      text: '#S9P2 KALDIR',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-3',
      receivedAt: now,
    });
    expect(duplicate).toMatchObject({
      handled: true,
      mutated: false,
      duplicate: true,
    });
    expect(mocks.tx.crmProperty.updateMany).toHaveBeenCalledTimes(1);
  });

  it('patron tut dediğinde portföyü RESERVED bırakır ve satıldı olarak kapatmaz', async () => {
    const prompt = loadedPrompt('SALE_DECISION');
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      openSummary(prompt),
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst
      .mockResolvedValueOnce(prompt)
      .mockResolvedValueOnce(null);
    mocks.tx.appointmentOutcome.findFirst.mockResolvedValue({
      id: 'outcome-a',
      saleDecision: 'PENDING',
    });

    const result = await processViewingInteractionReply({
      companyAccountId: 'company-a',
      recipientType: 'OWNER',
      recipientId: 'company-a',
      text: '#S9P2 TUT',
      provider: 'WAHA',
      providerMessageId: 'provider-reply-keep',
      receivedAt: now,
    });

    expect(result).toMatchObject({
      handled: true,
      mutated: true,
      action: 'PROPERTY_RESERVED',
    });
    expect(mocks.tx.crmProperty.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-a',
        companyAccountId: 'company-a',
        status: { in: ['ACTIVE', 'RESERVED'] },
      },
      data: { status: 'RESERVED' },
    });
    expect(mocks.tx.crmDeal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'deal-a',
          companyAccountId: 'company-a',
        }),
        data: { stage: 'CONTRACT', probability: 90 },
      })
    );
  });

  it('panel kararı promptu yalnız doğru tenant ve patron kimliğiyle açar', async () => {
    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValue(null);

    const result = await processViewingPanelDecision({
      companyAccountId: 'company-a',
      ownerId: 'company-a',
      promptId: 'foreign-prompt',
      action: 'REMOVE',
      idempotencyKey: 'request-a',
      now,
    });

    expect(result).toMatchObject({ handled: true, mutated: false, stale: true });
    expect(mocks.tx.whatsAppInteractionPrompt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'foreign-prompt',
          companyAccountId: 'company-a',
          recipientType: 'OWNER',
          recipientId: 'company-a',
          status: 'OPEN',
        }),
      })
    );
    expect(mocks.tx.crmProperty.updateMany).not.toHaveBeenCalled();
  });

  it('askıya alınmış tenant için ACK timeout durumunu ilerletmez', async () => {
    mocks.findAssignmentAttempts.mockResolvedValue([
      { id: 'attempt-a', companyAccountId: 'company-a' },
    ]);
    mocks.tx.companyAccount.findUnique.mockResolvedValue({
      status: 'SUSPENDED',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: null,
      workspaceEnabled: true,
    });

    const result = await processDueViewingAcknowledgements(now);

    expect(result).toEqual([
      { attemptId: 'attempt-a', status: 'SKIPPED_ACCOUNT_INACTIVE' },
    ]);
    expect(mocks.tx.viewingAssignmentAttempt.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.viewingAssignmentAttempt.updateMany).not.toHaveBeenCalled();
    expect(mocks.transitionTask).not.toHaveBeenCalled();
  });

  it('şirketin 5 dakikalık ayarıyla tek ve idempotent ACK hatırlatması kuyruğa alır', async () => {
    mocks.tx.companyAccount.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: null,
      workspaceEnabled: true,
      companyName: 'Akar Group',
      onboardingState: null,
    });
    mocks.tx.companySettings.findUnique.mockResolvedValue({
      employeeReminderMinutes: 5,
      employeeAcknowledgementMinutes: 15,
      ownerEscalationMinutes: 15,
      appointmentReminderHours: 24,
      appointmentOutcomeDelayMinutes: 30,
    });
    mocks.tx.whatsAppInteractionPrompt.findMany.mockResolvedValue([
      { id: 'assignment-prompt-a', companyAccountId: 'company-a' },
    ]);
    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValue({
      id: 'assignment-prompt-a',
      companyAccountId: 'company-a',
      status: 'OPEN',
      promptType: 'EMPLOYEE_ASSIGNMENT',
      expectedResponseType: 'ASSIGNMENT_ACK',
      reminderCount: 0,
      lastReminderAt: null,
      assignmentAttempt: {
        id: 'attempt-a',
        companyAccountId: 'company-a',
        workflowId: 'workflow-a',
        taskId: 'task-a',
        propertyId: 'property-a',
        contactId: 'contact-a',
        memberId: 'member-a',
        sequence: 1,
        status: 'AWAITING_ACK',
        sentAt: new Date('2026-08-02T12:00:00.000Z'),
        ackDeadlineAt: new Date('2026-08-02T12:15:00.000Z'),
        providerMessageId: 'provider-original-a',
        member: {
          id: 'member-a',
          name: 'Zeynep',
          phoneNormalized: '905551112233',
        },
        workflow: {
          id: 'workflow-a',
          shortCode: 'V7K2',
          conversationId: 'conversation-a',
        },
      },
    });
    mocks.createOutbox.mockResolvedValue({ id: 'outbox-reminder-a' });

    const result = await processDueViewingAcknowledgementReminders(
      new Date('2026-08-02T12:05:00.000Z')
    );

    expect(result).toEqual([
      {
        promptId: 'assignment-prompt-a',
        status: 'REMINDER_QUEUED',
        reminderCount: 1,
      },
    ]);
    expect(mocks.tx.whatsAppInteractionPrompt.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'assignment-prompt-a',
        companyAccountId: 'company-a',
        status: 'OPEN',
        reminderCount: 0,
        lastReminderAt: null,
      },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date('2026-08-02T12:05:00.000Z'),
      },
    });
    expect(mocks.createOutbox).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        companyAccountId: 'company-a',
        recipientType: 'EMPLOYEE',
        recipientId: 'member-a',
        purpose: 'EMPLOYEE_ASSIGNMENT_REMINDER',
        idempotencyKey: 'viewing:workflow-a:attempt:1:ack-reminder:1',
        replyToProviderMessageId: 'provider-original-a',
      })
    );

    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValue({
      ...(await mocks.tx.whatsAppInteractionPrompt.findFirst.mock.results[0]
        ?.value),
      reminderCount: 1,
      lastReminderAt: new Date('2026-08-02T12:05:00.000Z'),
    });
    const duplicate = await processDueViewingAcknowledgementReminders(
      new Date('2026-08-02T12:05:00.000Z')
    );
    expect(duplicate).toEqual([
      { promptId: 'assignment-prompt-a', status: 'SKIPPED_NOT_DUE' },
    ]);
    expect(mocks.createOutbox).toHaveBeenCalledTimes(1);
  });

  it('sağlayıcı hatası ACK bekleyen çalışanı timeout adayı olmaktan çıkarır', async () => {
    mocks.tx.viewingAssignmentAttempt.findFirst.mockResolvedValue({
      id: 'attempt-a',
      companyAccountId: 'company-a',
      workflowId: 'workflow-a',
      taskId: 'task-a',
      status: 'AWAITING_ACK',
      workflow: { id: 'workflow-a' },
    });
    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValue({
      id: 'assignment-prompt-a',
      status: 'OPEN',
      appointmentRequestId: 'appointment-a',
    });

    await applyViewingDeliveryTransitionInTransaction(mocks.tx as never, {
      companyAccountId: 'company-a',
      outboxMessageId: 'outbox-a',
      status: 'FAILED',
      providerMessageId: 'provider-a',
      errorMessage: 'Gateway teslim etmedi',
      occurredAt: now,
    });

    expect(mocks.tx.viewingAssignmentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'attempt-a',
        companyAccountId: 'company-a',
        status: { in: ['AWAITING_SEND', 'AWAITING_ACK'] },
      },
      data: {
        status: 'DELIVERY_FAILED',
        failureReason: 'Gateway teslim etmedi',
        providerMessageId: 'provider-a',
        ackDeadlineAt: null,
      },
    });
    expect(mocks.tx.viewingWorkflow.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'workflow-a',
        companyAccountId: 'company-a',
        status: {
          in: ['AWAITING_ASSIGNMENT_SEND', 'AWAITING_EMPLOYEE_ACK'],
        },
      },
      data: {
        status: 'FAILED',
        version: { increment: 1 },
        lastError: 'Gateway teslim etmedi',
      },
    });
  });

  it('eşzamanlı kabul edilmiş atamayı gecikmiş sağlayıcı hatasıyla bozmaz', async () => {
    mocks.tx.viewingAssignmentAttempt.findFirst.mockResolvedValue({
      id: 'attempt-a',
      companyAccountId: 'company-a',
      workflowId: 'workflow-a',
      taskId: 'task-a',
      status: 'AWAITING_ACK',
      workflow: { id: 'workflow-a' },
    });
    mocks.tx.viewingAssignmentAttempt.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    mocks.tx.whatsAppInteractionPrompt.findFirst.mockResolvedValue(null);

    await applyViewingDeliveryTransitionInTransaction(mocks.tx as never, {
      companyAccountId: 'company-a',
      outboxMessageId: 'outbox-a',
      status: 'FAILED',
      providerMessageId: 'provider-a',
      errorMessage: 'Gecikmiş sağlayıcı olayı',
      occurredAt: now,
    });

    expect(mocks.tx.viewingWorkflow.updateMany).not.toHaveBeenCalled();
  });
});
