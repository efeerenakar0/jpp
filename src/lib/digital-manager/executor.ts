import { createHash } from 'node:crypto';

import {
  Prisma,
  type GeneralManagerAction,
  type ManagerRiskLevel,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

import {
  managerExecutableActionSchema,
  parseManagerActionPayload,
  type ManagerExecutableAction,
} from './action-schema';
import { getCompanyOperationalStatus } from './company-guard';
import { normalizeE164 } from './domain';
import { appendManagerAudit } from './events';
import { resolveManagerPolicyOverride } from './manager-policy';
import { memberAssignmentAvailability } from './member-availability';
import {
  evaluateActionPolicy,
  shouldNotifyOwnerNow,
  type ManagerPolicySettings,
} from './policy';
import { transitionTaskInTransaction } from './tasks';

function actionHash(input: {
  companyAccountId: string;
  operationEventId?: string | null;
  action: ManagerExecutableAction;
  requestedByType: string;
  requestedById?: string | null;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        companyAccountId: input.companyAccountId,
        operationEventId: input.operationEventId || null,
        action: input.action,
        requestedByType: input.requestedByType,
        requestedById: input.requestedById || null,
      })
    )
    .digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nested]) =>
          `${JSON.stringify(key)}:${canonicalJson(nested)}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

async function assertCompanyOperational(
  companyAccountId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const operational = await getCompanyOperationalStatus(
    companyAccountId,
    db
  );
  if (!operational.allowed) {
    throw new Error(`Şirket işlemlere kapalı: ${operational.reason}.`);
  }
}

async function assertActionReferences(
  tx: Prisma.TransactionClient,
  input: {
    companyAccountId: string;
    operationEventId?: string | null;
    requestedByType: string;
    requestedById?: string | null;
  }
) {
  if (input.operationEventId) {
    const event = await tx.operationEvent.findFirst({
      where: {
        id: input.operationEventId,
        companyAccountId: input.companyAccountId,
      },
      select: { id: true },
    });
    if (!event) {
      throw new Error('Aksiyon olayı bu şirket hesabına ait değil.');
    }
  }
  if (input.requestedByType === 'OWNER') {
    if (input.requestedById !== input.companyAccountId) {
      throw new Error('Patron kimliği şirket hesabıyla eşleşmiyor.');
    }
  } else if (input.requestedByType === 'EMPLOYEE') {
    if (!input.requestedById) {
      throw new Error('Çalışan kimliği eksik.');
    }
    const member = await tx.companyMember.findFirst({
      where: {
        id: input.requestedById,
        companyAccountId: input.companyAccountId,
        active: true,
      },
      select: { id: true },
    });
    if (!member) {
      throw new Error('Aksiyonu isteyen çalışan bu şirkette aktif değil.');
    }
  }
}

async function getPolicySettings(companyAccountId: string) {
  return prisma.managerNotificationPreference.upsert({
    where: { companyAccountId },
    update: {},
    create: { companyAccountId },
  });
}

async function getActiveManagerPolicies(companyAccountId: string) {
  const now = new Date();
  return prisma.managerPolicy.findMany({
    where: {
      companyAccountId,
      status: 'ACTIVE',
      effectiveFrom: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ruleType: {
        in: ['MUTE_OPERATION_EVENT', 'AUTO_APPROVE_ACTION_TYPE'],
      },
    },
    select: {
      ruleType: true,
      rulePayload: true,
      sourceActionId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

function toPolicySettings(
  settings: Awaited<ReturnType<typeof getPolicySettings>>
): ManagerPolicySettings {
  return {
    autonomyMode: settings.autonomyMode,
    allowAutomaticEmployeeAssignment:
      settings.allowAutomaticEmployeeAssignment,
    allowAutomaticEmployeeWhatsApp:
      settings.allowAutomaticEmployeeWhatsApp,
    notifyCriticalImmediately: settings.notifyCriticalImmediately,
    notifyTaskAccepted: settings.notifyTaskAccepted,
    notifyOnlyProblemsAndDelays: settings.notifyOnlyProblemsAndDelays,
    alwaysNotifyHotLeads: settings.alwaysNotifyHotLeads,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
    timezone: settings.timezone,
  };
}

export async function proposeManagerAction(input: {
  companyAccountId: string;
  operationEventId?: string | null;
  triggerMessageId?: string | null;
  action: ManagerExecutableAction;
  reason: string;
  evidence?: Prisma.InputJsonValue;
  confidence: number;
  riskLevel: ManagerRiskLevel;
  containsBindingCommitment?: boolean;
  requestedByType: string;
  requestedById?: string | null;
  provider?: string | null;
  model?: string | null;
  idempotencyKey?: string;
}) {
  const actionPayload = managerExecutableActionSchema.parse(input.action);
  await assertCompanyOperational(input.companyAccountId);
  const [settings, activePolicies] = await Promise.all([
    getPolicySettings(input.companyAccountId),
    getActiveManagerPolicies(input.companyAccountId),
  ]);
  const basePolicy = evaluateActionPolicy(
    {
      actionType: actionPayload.actionType,
      riskLevel: input.riskLevel,
      statusProposal:
        actionPayload.actionType === 'UPDATE_TASK_STATUS'
          ? actionPayload.status
          : null,
      containsBindingCommitment: input.containsBindingCommitment,
      hasAutomaticAssignment:
        actionPayload.actionType === 'CREATE_TASK' &&
        Boolean(actionPayload.assignedMemberId),
    },
    toPolicySettings(settings)
  );
  const override = resolveManagerPolicyOverride({
    actionType: actionPayload.actionType,
    riskLevel: input.riskLevel,
    operationEventId: input.operationEventId,
    policies: activePolicies,
  });
  const policy =
    override?.decision === 'MUTE'
      ? {
          decision: 'MUTED_BY_OWNER' as const,
          requiresApproval: false,
          reason: override.reason,
        }
      : override?.decision === 'AUTO_EXECUTE'
        ? {
            decision: 'AUTO_EXECUTE' as const,
            requiresApproval: false,
            reason: override.reason,
          }
        : basePolicy;
  const idempotencyKey =
    input.idempotencyKey || actionHash({ ...input, action: actionPayload });
  const requiresApproval = policy.requiresApproval;
  const initialStatus =
    actionPayload.actionType === 'NO_ACTION' ||
    policy.decision === 'MUTED_BY_OWNER'
      ? ('EXECUTED' as const)
      : policy.decision === 'AUTO_EXECUTE'
        ? ('APPROVED' as const)
        : ('PENDING_APPROVAL' as const);

  const action = await prisma.$transaction(async (tx) => {
    await assertCompanyOperational(input.companyAccountId, tx);
    await assertActionReferences(tx, input);
    const stored = await tx.generalManagerAction.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey,
        },
      },
      update: {},
      create: {
        companyAccountId: input.companyAccountId,
        operationEventId: input.operationEventId,
        triggerMessageId: input.triggerMessageId,
        taskId:
          'taskId' in actionPayload
            ? actionPayload.taskId || undefined
            : undefined,
        actionType: actionPayload.actionType,
        targetType:
          'employeeId' in actionPayload && actionPayload.employeeId
            ? 'COMPANY_MEMBER'
            : 'contactId' in actionPayload && actionPayload.contactId
              ? 'CRM_CONTACT'
              : 'conversationId' in actionPayload
                ? 'CUSTOMER_CONVERSATION'
                : null,
        targetId:
          ('employeeId' in actionPayload &&
            actionPayload.employeeId) ||
          ('contactId' in actionPayload && actionPayload.contactId) ||
          ('conversationId' in actionPayload &&
            actionPayload.conversationId) ||
          null,
        reason: input.reason,
        evidence: input.evidence,
        confidence: Math.max(0, Math.min(1, input.confidence)),
        riskLevel: input.riskLevel,
        requiresApproval,
        policyDecision: policy.decision,
        payload: actionPayload,
        proposedMessage:
          'message' in actionPayload
            ? actionPayload.message
            : 'question' in actionPayload
              ? actionPayload.question
              : null,
        status: initialStatus,
        idempotencyKey,
        provider: input.provider,
        model: input.model,
        requestedByType: input.requestedByType,
        requestedById: input.requestedById,
        approvedAt:
          initialStatus === 'APPROVED' ? new Date() : undefined,
        executedAt:
          initialStatus === 'EXECUTED' ? new Date() : undefined,
      },
    });
    const sameIdentity =
      stored.actionType === actionPayload.actionType &&
      stored.operationEventId === (input.operationEventId || null) &&
      stored.triggerMessageId === (input.triggerMessageId || null) &&
      stored.requestedByType === input.requestedByType &&
      stored.requestedById === (input.requestedById || null) &&
      canonicalJson(stored.payload) === canonicalJson(actionPayload);
    if (!sameIdentity) {
      throw new Error(
        'Aynı idempotency anahtarı farklı bir yönetici aksiyonu için kullanılamaz.'
      );
    }
    if (requiresApproval) {
      await tx.actionApproval.upsert({
        where: { actionId: stored.id },
        update: {},
        create: {
          companyAccountId: input.companyAccountId,
          actionId: stored.id,
        },
      });
    }
    await appendManagerAudit(
      {
        companyAccountId: input.companyAccountId,
        operationEventId: input.operationEventId,
        managerActionId: stored.id,
        actorType: input.requestedByType,
        actorId: input.requestedById,
        operation: 'PROPOSE_ACTION',
        entityType: stored.targetType,
        entityId: stored.targetId,
        evidence: input.evidence,
        structuredAi: actionPayload,
        confidence: input.confidence,
        policyDecision: policy.decision,
        result: initialStatus,
        completedAt: new Date(),
      },
      tx
    );
    return stored;
  });

  if (action.status === 'APPROVED') {
    return executeApprovedManagerAction({
      companyAccountId: input.companyAccountId,
      actionId: action.id,
      actorType: 'POLICY_ENGINE',
      actorId: null,
    });
  }
  return action;
}

async function assertMember(
  tx: Prisma.TransactionClient,
  companyAccountId: string,
  memberId: string
) {
  const member = await tx.companyMember.findFirst({
    where: { id: memberId, companyAccountId, active: true },
  });
  if (!member) throw new Error('Aktif ekip üyesi bu şirkette bulunamadı.');
  return member;
}

async function lockMemberCapacity(
  tx: Prisma.TransactionClient,
  companyAccountId: string,
  memberId: string
) {
  await tx.$queryRaw(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${companyAccountId}:${memberId}:task-capacity`}, 0)
      )
    `
  );
}

async function assertAssignableMember(
  tx: Prisma.TransactionClient,
  companyAccountId: string,
  memberId: string,
  excludeTaskId?: string
) {
  const member = await assertMember(tx, companyAccountId, memberId);
  const availability = memberAssignmentAvailability(member);
  if (!availability.allowed) {
    const labels = {
      MEMBER_INACTIVE: 'aktif değil',
      MEMBER_UNAVAILABLE: 'şu anda müsait değil',
      OUTSIDE_WORK_HOURS: 'çalışma saatleri dışında',
    } as const;
    throw new Error(
      `${member.name} ${labels[availability.reason]}; görev atanamaz.`
    );
  }
  await lockMemberCapacity(tx, companyAccountId, member.id);
  const activeTaskCount = await tx.crmTask.count({
    where: {
      companyAccountId,
      assignedMemberId: member.id,
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      status: 'OPEN',
      workflowStatus: {
        notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
      },
    },
  });
  if (activeTaskCount >= member.maxActiveTaskCapacity) {
    throw new Error(
      `${member.name} aktif görev kapasitesine ulaşmış durumda.`
    );
  }
  return member;
}

async function assertOptionalEntities(
  tx: Prisma.TransactionClient,
  input: {
    companyAccountId: string;
    contactId?: string | null;
    propertyId?: string | null;
    dealId?: string | null;
  }
) {
  const [contact, property, deal] = await Promise.all([
    input.contactId
      ? tx.crmContact.findFirst({
          where: {
            id: input.contactId,
            companyAccountId: input.companyAccountId,
          },
          select: { id: true },
        })
      : null,
    input.propertyId
      ? tx.crmProperty.findFirst({
          where: {
            id: input.propertyId,
            companyAccountId: input.companyAccountId,
          },
          select: { id: true },
        })
      : null,
    input.dealId
      ? tx.crmDeal.findFirst({
          where: {
            id: input.dealId,
            companyAccountId: input.companyAccountId,
          },
          select: { id: true },
        })
      : null,
  ]);
  if (input.contactId && !contact) {
    throw new Error('Müşteri bu şirkette bulunamadı.');
  }
  if (input.propertyId && !property) {
    throw new Error('Portföy bu şirkette bulunamadı.');
  }
  if (input.dealId && !deal) {
    throw new Error('Satış fırsatı bu şirkette bulunamadı.');
  }
}

function outboxPhone(phone: string | null | undefined) {
  const normalized = normalizeE164(phone);
  if (!normalized) {
    throw new Error('Alıcının doğrulanmış telefon numarası yok.');
  }
  return normalized.replace(/\D/g, '');
}

async function createInternalOutbox(
  tx: Prisma.TransactionClient,
  input: {
    action: GeneralManagerAction;
    recipientType: 'OWNER' | 'EMPLOYEE';
    recipientId: string;
    phone: string;
    content: string;
    taskId?: string | null;
    purpose: string;
  }
) {
  const config = await tx.whatsAppConfig.findUnique({
    where: { companyAccountId: input.action.companyAccountId },
    select: { connectedPhone: true },
  });
  const toPhone = outboxPhone(input.phone);
  if (
    normalizeE164(config?.connectedPhone) ===
    normalizeE164(input.phone)
  ) {
    throw new Error(
      'Şirketin bağlı WhatsApp numarasına dahili görev gönderilemez.'
    );
  }
  const outbox = await tx.whatsAppOutboxMessage.upsert({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.action.companyAccountId,
        idempotencyKey: `manager-action:${input.action.id}`,
      },
    },
    update: {},
    create: {
      companyAccountId: input.action.companyAccountId,
      toPhone,
      content: input.content,
      provider: 'WAHA',
      status: 'QUEUED',
      idempotencyKey: `manager-action:${input.action.id}`,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      purpose: input.purpose,
      relatedTaskId: input.taskId,
      managerActionId: input.action.id,
      operationEventId: input.action.operationEventId,
      correlationId: input.action.id,
      createdByType: 'DIGITAL_GENERAL_MANAGER',
      createdById: input.action.requestedById,
    },
  });
  await tx.messageDeliveryAudit.createMany({
    data: [
      {
        companyAccountId: input.action.companyAccountId,
        outboxMessageId: outbox.id,
        status: 'QUEUED',
        metadata: {
          purpose: input.purpose,
          managerActionId: input.action.id,
        },
        idempotencyKey: `outbox:${outbox.id}:queued`,
      },
    ],
    skipDuplicates: true,
  });
  return outbox;
}

async function executeActionInTransaction(
  tx: Prisma.TransactionClient,
  action: GeneralManagerAction,
  executable: ManagerExecutableAction
) {
  switch (executable.actionType) {
    case 'CREATE_TASK': {
      await assertOptionalEntities(tx, {
        companyAccountId: action.companyAccountId,
        contactId: executable.contactId,
        propertyId: executable.propertyId,
      });
      if (executable.assignedMemberId) {
        await assertAssignableMember(
          tx,
          action.companyAccountId,
          executable.assignedMemberId
        );
      }
      const task = await tx.crmTask.upsert({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: action.companyAccountId,
            idempotencyKey: `manager-action:${action.id}`,
          },
        },
        update: {},
        create: {
          companyAccountId: action.companyAccountId,
          title: executable.title,
          description: executable.description,
          type: executable.taskType,
          contactId: executable.contactId,
          propertyId: executable.propertyId,
          assignedMemberId: executable.assignedMemberId,
          dueAt: executable.dueAt ? new Date(executable.dueAt) : null,
          priority: executable.priority,
          workflowStatus: 'CREATED',
          assignedAt: null,
          lastStatusAt: new Date(),
          idempotencyKey: `manager-action:${action.id}`,
          originEventId: action.operationEventId,
        },
      });
      return executable.assignedMemberId
        ? transitionTaskInTransaction(tx, {
            companyAccountId: action.companyAccountId,
            taskId: task.id,
            toStatus: 'ASSIGNED',
            evidenceText: 'Görev oluşturulurken doğrulanmış ekip üyesine atandı.',
            operationEventId: action.operationEventId,
            managerActionId: action.id,
            actorType: 'DIGITAL_GENERAL_MANAGER',
            actorId: action.requestedById,
            idempotencyKey: `manager-action:${action.id}:initial-assignment`,
          })
        : task;
    }
    case 'ASSIGN_EMPLOYEE':
    case 'REASSIGN_EMPLOYEE': {
      const member = await assertAssignableMember(
        tx,
        action.companyAccountId,
        executable.employeeId,
        executable.taskId
      );
      const task = await tx.crmTask.findFirst({
        where: {
          id: executable.taskId,
          companyAccountId: action.companyAccountId,
        },
      });
      if (!task) throw new Error('Görev bu şirkette bulunamadı.');
      await tx.crmTask.update({
        where: { id: task.id },
        data: {
          assignedMemberId: member.id,
          assignmentReason: executable.reason,
          assignedAt: new Date(),
        },
      });
      await tx.companyMember.update({
        where: { id: member.id },
        data: { lastAssignedAt: new Date() },
      });
      return transitionTaskInTransaction(tx, {
        companyAccountId: action.companyAccountId,
        taskId: task.id,
        toStatus: 'ASSIGNED',
        evidenceText: executable.reason,
        operationEventId: action.operationEventId,
        managerActionId: action.id,
        actorType: 'DIGITAL_GENERAL_MANAGER',
        actorId: action.requestedById,
        reason: executable.reason,
        idempotencyKey: `manager-action:${action.id}:assign`,
      });
    }
    case 'UPDATE_TASK_STATUS': {
      if (action.requestedByType === 'EMPLOYEE') {
        const task = await tx.crmTask.findFirst({
          where: {
            id: executable.taskId,
            companyAccountId: action.companyAccountId,
            assignedMemberId: action.requestedById || undefined,
          },
          select: { id: true },
        });
        if (!task) {
          throw new Error(
            'Çalışan yalnız kendisine atanmış görevin durumunu değiştirebilir.'
          );
        }
      }
      return transitionTaskInTransaction(tx, {
        companyAccountId: action.companyAccountId,
        taskId: executable.taskId,
        toStatus: executable.status,
        evidenceText: executable.evidenceText,
        operationEventId: action.operationEventId,
        managerActionId: action.id,
        sourceMessageId: executable.sourceMessageId,
        actorType: 'DIGITAL_GENERAL_MANAGER',
        actorId: action.requestedById,
        idempotencyKey: `manager-action:${action.id}:status`,
      });
    }
    case 'CREATE_COMMITMENT': {
      await assertOptionalEntities(tx, {
        companyAccountId: action.companyAccountId,
        contactId: executable.contactId,
        propertyId: executable.propertyId,
      });
      if (executable.employeeId) {
        await assertMember(
          tx,
          action.companyAccountId,
          executable.employeeId
        );
      }
      if (executable.taskId) {
        const task = await tx.crmTask.findFirst({
          where: {
            id: executable.taskId,
            companyAccountId: action.companyAccountId,
          },
          select: { id: true },
        });
        if (!task) throw new Error('Görev bu şirkette bulunamadı.');
      }
      return tx.operationalCommitment.upsert({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: action.companyAccountId,
            idempotencyKey: `manager-action:${action.id}`,
          },
        },
        update: {},
        create: {
          companyAccountId: action.companyAccountId,
          taskId: executable.taskId,
          memberId: executable.employeeId,
          contactId: executable.contactId,
          propertyId: executable.propertyId,
          operationEventId: action.operationEventId,
          managerActionId: action.id,
          description: executable.description,
          sourceMessageId: executable.sourceMessageId,
          relativeTimeText: executable.relativeTimeText,
          dueAt: executable.dueAt
            ? new Date(executable.dueAt)
            : null,
          certainty: executable.certainty,
          idempotencyKey: `manager-action:${action.id}`,
        },
      });
    }
    case 'CREATE_CRM_ACTIVITY': {
      await assertOptionalEntities(tx, {
        companyAccountId: action.companyAccountId,
        contactId: executable.contactId,
        propertyId: executable.propertyId,
        dealId: executable.dealId,
      });
      return tx.crmActivity.create({
        data: {
          companyAccountId: action.companyAccountId,
          contactId: executable.contactId,
          propertyId: executable.propertyId,
          dealId: executable.dealId,
          type: executable.activityType,
          title: executable.title,
          description: executable.description,
          metadata: JSON.stringify({
            managerActionId: action.id,
            operationEventId: action.operationEventId,
          }),
        },
      });
    }
    case 'UPDATE_LEAD_STAGE': {
      const updated = await tx.crmContact.updateMany({
        where: {
          id: executable.contactId,
          companyAccountId: action.companyAccountId,
        },
        data: { stage: executable.stage },
      });
      if (updated.count !== 1) {
        throw new Error('Müşteri bu şirkette bulunamadı.');
      }
      return updated;
    }
    case 'SEND_EMPLOYEE_WHATSAPP': {
      const member = await assertMember(
        tx,
        action.companyAccountId,
        executable.employeeId
      );
      if (
        !(member.phoneNormalized || member.phone) ||
        !member.canReceiveWhatsAppTasks
      ) {
        throw new Error(
          'Çalışanın kayıtlı ve görev alabilen bir WhatsApp numarası yok.'
        );
      }
      if (!action.requiresApproval) {
        const availability = memberAssignmentAvailability(member);
        if (!availability.allowed) {
          throw new Error(
            'Çalışan şu anda müsait veya çalışma saatleri içinde değil.'
          );
        }
      }
      if (
        !action.requiresApproval &&
        !member.allowAutomaticInternalMessages
      ) {
        throw new Error(
          'Çalışan otomatik dahili WhatsApp mesajlarına izin vermiyor.'
        );
      }
      const outbox = await createInternalOutbox(tx, {
        action,
        recipientType: 'EMPLOYEE',
        recipientId: member.id,
        phone: member.phoneNormalized || member.phone || '',
        content: executable.message,
        taskId: executable.taskId,
        purpose: 'EMPLOYEE_TASK',
      });
      if (executable.taskId) {
        await transitionTaskInTransaction(tx, {
          companyAccountId: action.companyAccountId,
          taskId: executable.taskId,
          toStatus: 'MESSAGE_QUEUED',
          evidenceText: 'Çalışan görev mesajı WhatsApp kuyruğuna alındı.',
          operationEventId: action.operationEventId,
          managerActionId: action.id,
          sourceMessageId: `outbox:${outbox.id}`,
          actorType: 'DIGITAL_GENERAL_MANAGER',
          actorId: action.requestedById,
          idempotencyKey: `manager-action:${action.id}:message-queued`,
        });
      }
      return outbox;
    }
    case 'NOTIFY_OWNER': {
      const [account, preference, operationEvent] = await Promise.all([
        tx.companyAccount.findUnique({
          where: { id: action.companyAccountId },
          select: {
            ownerPhoneNormalized: true,
          },
        }),
        tx.managerNotificationPreference.upsert({
          where: { companyAccountId: action.companyAccountId },
          update: {},
          create: { companyAccountId: action.companyAccountId },
        }),
        action.operationEventId
          ? tx.operationEvent.findFirst({
              where: {
                id: action.operationEventId,
                companyAccountId: action.companyAccountId,
              },
              select: { eventType: true },
            })
          : null,
      ]);
      const eventType = operationEvent?.eventType || 'GENERAL_MANAGER_UPDATE';
      const importance =
        eventType === 'MESSAGE_DELIVERY_FAILED' ||
        eventType === 'COMMITMENT_OVERDUE'
          ? ('CRITICAL' as const)
          : executable.important
            ? ('IMPORTANT' as const)
            : ('NORMAL' as const);
      await tx.notification.upsert({
        where: {
          companyAccountId_recipientKey_dedupeKey: {
            companyAccountId: action.companyAccountId,
            recipientKey: 'OWNER',
            dedupeKey: `manager-action:${action.id}`,
          },
        },
        update: {},
        create: {
          companyAccountId: action.companyAccountId,
          recipientKey: 'OWNER',
          type: 'SYSTEM',
          title: 'Dijital Genel Müdür',
          message: executable.message,
          link: '/fabrika',
          important: executable.important,
          dedupeKey: `manager-action:${action.id}`,
          metadata: JSON.stringify({
            managerActionId: action.id,
            eventType,
            importance,
          }),
        },
      });
      const ownerPhone =
        preference?.ownerPhoneNormalized || account?.ownerPhoneNormalized || null;
      const notifyNow = shouldNotifyOwnerNow(
        { importance, eventType },
        toPolicySettings(preference)
      );
      return ownerPhone && notifyNow
        ? createInternalOutbox(tx, {
            action,
            recipientType: 'OWNER',
            recipientId: action.companyAccountId,
            phone: ownerPhone,
            content: executable.message,
            purpose: 'OWNER_NOTIFICATION',
          })
        : null;
    }
    case 'OFFER_CONVERSATION_HANDOFF': {
      const conversation = await tx.customerConversation.findFirst({
        where: {
          id: executable.conversationId,
          companyAccountId: action.companyAccountId,
        },
      });
      if (!conversation) {
        throw new Error('Sohbet bu şirkette bulunamadı.');
      }
      if (executable.employeeId) {
        await assertMember(
          tx,
          action.companyAccountId,
          executable.employeeId
        );
      }
      return tx.conversationHandoff.upsert({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: action.companyAccountId,
            idempotencyKey: `manager-action:${action.id}`,
          },
        },
        update: {},
        create: {
          companyAccountId: action.companyAccountId,
          conversationId: conversation.id,
          managerActionId: action.id,
          requestedByType: 'DIGITAL_GENERAL_MANAGER',
          requestedById: action.requestedById,
          assignedMemberId: executable.employeeId,
          status: 'PROPOSED',
          summary: executable.summary,
          verifiedContext: {
            conversationId: conversation.id,
            customerName: conversation.customerName,
          },
          idempotencyKey: `manager-action:${action.id}`,
        },
      });
    }
    case 'SCHEDULE_APPOINTMENT': {
      await assertOptionalEntities(tx, {
        companyAccountId: action.companyAccountId,
        contactId: executable.contactId,
        propertyId: executable.propertyId,
      });
      if (executable.assignedMemberId) {
        await assertMember(
          tx,
          action.companyAccountId,
          executable.assignedMemberId
        );
      }
      const appointmentTask = await tx.crmTask.upsert({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: action.companyAccountId,
            idempotencyKey: `manager-action:${action.id}`,
          },
        },
        update: {},
        create: {
          companyAccountId: action.companyAccountId,
          contactId: executable.contactId,
          propertyId: executable.propertyId,
          assignedMemberId: executable.assignedMemberId,
          type: 'MEETING',
          title: executable.title,
          dueAt: new Date(executable.startAt),
          endAt: executable.endAt ? new Date(executable.endAt) : null,
          workflowStatus: 'CREATED',
          lastStatusAt: new Date(),
          idempotencyKey: `manager-action:${action.id}`,
          originEventId: action.operationEventId,
        },
      });
      return transitionTaskInTransaction(tx, {
        companyAccountId: action.companyAccountId,
        taskId: appointmentTask.id,
        toStatus: executable.confirmed
          ? 'APPOINTMENT_CONFIRMED'
          : 'APPOINTMENT_PROPOSED',
        evidenceText: executable.confirmed
          ? 'Randevu insan onayıyla kesinleştirildi.'
          : 'Randevu önerisi oluşturuldu; henüz kesinleşmedi.',
        operationEventId: action.operationEventId,
        managerActionId: action.id,
        actorType: 'DIGITAL_GENERAL_MANAGER',
        actorId: action.requestedById,
        idempotencyKey: `manager-action:${action.id}:appointment-status`,
      });
    }
    case 'ASK_CLARIFICATION': {
      if (executable.recipientType === 'EMPLOYEE') {
        const member = await assertMember(
          tx,
          action.companyAccountId,
          executable.recipientId
        );
        if (
          !(member.phoneNormalized || member.phone) ||
          !member.canReceiveWhatsAppTasks
        ) {
          throw new Error(
            'Çalışanın kayıtlı ve görev mesajına izin veren telefonu yok.'
          );
        }
        if (
          !action.requiresApproval &&
          !member.allowAutomaticInternalMessages
        ) {
          throw new Error(
            'Çalışan otomatik dahili WhatsApp mesajlarına izin vermiyor.'
          );
        }
        return createInternalOutbox(tx, {
          action,
          recipientType: 'EMPLOYEE',
          recipientId: member.id,
          phone: member.phoneNormalized || member.phone || '',
          content: executable.question,
          purpose: 'CLARIFICATION',
        });
      }
      if (executable.recipientId !== action.companyAccountId) {
        throw new Error('Patron kimliği şirketle eşleşmiyor.');
      }
      const account = await tx.companyAccount.findUnique({
        where: { id: action.companyAccountId },
        select: {
          ownerPhoneNormalized: true,
        },
      });
      if (!account?.ownerPhoneNormalized) {
        throw new Error('Patronun kayıtlı telefonu bulunamadı.');
      }
      return createInternalOutbox(tx, {
        action,
        recipientType: 'OWNER',
        recipientId: action.companyAccountId,
        phone: account.ownerPhoneNormalized || '',
        content: executable.question,
        purpose: 'CLARIFICATION',
      });
    }
    case 'CREATE_POLICY': {
      if (action.requestedByType !== 'OWNER') {
        throw new Error('Yalnız patron yönetim politikası oluşturabilir.');
      }
      if (executable.scope === 'CONVERSATION') {
        if (!executable.conversationId) {
          throw new Error(
            'Konuşmaya özel kural için doğrulanmış sohbet seçilmelidir.'
          );
        }
        const conversation = await tx.customerConversation.findFirst({
          where: {
            id: executable.conversationId,
            companyAccountId: action.companyAccountId,
          },
          select: { id: true },
        });
        if (!conversation) {
          throw new Error('Kuralın bağlı olduğu sohbet bu şirkette bulunamadı.');
        }
      }
      const expiresAt = executable.expiresAt
        ? new Date(executable.expiresAt)
        : null;
      if (
        executable.scope === 'TEMPORARY' &&
        (!expiresAt || expiresAt <= new Date())
      ) {
        throw new Error(
          'Zaman sınırlı politika için gelecekte bir bitiş zamanı gerekir.'
        );
      }
      return tx.managerPolicy.create({
        data: {
          companyAccountId: action.companyAccountId,
          scope: executable.scope,
          ruleType: 'NATURAL_LANGUAGE_INSTRUCTION',
          rulePayload: {
            instruction: executable.instruction,
          },
          conversationId: executable.conversationId,
          sourceMessageId: action.triggerMessageId,
          sourceActionId: action.id,
          createdByType: 'OWNER',
          createdById: action.requestedById,
          expiresAt:
            executable.scope === 'TEMPORARY' ? expiresAt : null,
        },
      });
    }
    case 'NO_ACTION':
      return null;
  }
}

export async function executeApprovedManagerAction(input: {
  companyAccountId: string;
  actionId: string;
  actorType: string;
  actorId?: string | null;
}) {
  await assertCompanyOperational(input.companyAccountId);
  const locked = await prisma.generalManagerAction.updateMany({
    where: {
      id: input.actionId,
      companyAccountId: input.companyAccountId,
      status: 'APPROVED',
    },
    data: {
      status: 'EXECUTING',
      executionStartedAt: new Date(),
      executionAttemptCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });
  if (locked.count === 0) {
    const existing = await prisma.generalManagerAction.findFirst({
      where: {
        id: input.actionId,
        companyAccountId: input.companyAccountId,
      },
    });
    if (!existing) throw new Error('Aksiyon bu şirkette bulunamadı.');
    if (existing.status === 'EXECUTED' || existing.status === 'EXECUTING') {
      return existing;
    }
    throw new Error(`Aksiyon çalıştırılamaz: ${existing.status}.`);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertCompanyOperational(input.companyAccountId, tx);
      const action = await tx.generalManagerAction.findFirst({
        where: {
          id: input.actionId,
          companyAccountId: input.companyAccountId,
          status: 'EXECUTING',
        },
      });
      if (!action) throw new Error('Kilitlenen aksiyon bulunamadı.');
      const executable = parseManagerActionPayload(
        action.actionType,
        action.payload
      );
      await executeActionInTransaction(tx, action, executable);
      const completed = await tx.generalManagerAction.update({
        where: { id: action.id },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      await appendManagerAudit(
        {
          companyAccountId: action.companyAccountId,
          operationEventId: action.operationEventId,
          managerActionId: action.id,
          actorType: input.actorType,
          actorId: input.actorId,
          operation: 'EXECUTE_ACTION',
          entityType: action.targetType,
          entityId: action.targetId,
          verifiedContext: {
            companyAccountId: action.companyAccountId,
            targetType: action.targetType,
            targetId: action.targetId,
          },
          evidence:
            action.evidence === null ? undefined : action.evidence,
          structuredAi:
            action.payload === null ? undefined : action.payload,
          confidence: action.confidence,
          policyDecision: action.policyDecision,
          result: 'EXECUTED',
          completedAt: new Date(),
        },
        tx
      );
      return completed;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Aksiyon çalıştırılamadı.';
    await prisma.$transaction(async (tx) => {
      await tx.generalManagerAction.updateMany({
        where: {
          id: input.actionId,
          companyAccountId: input.companyAccountId,
          status: 'EXECUTING',
        },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorCode: 'EXECUTION_FAILED',
          errorMessage: message,
        },
      });
      await appendManagerAudit(
        {
          companyAccountId: input.companyAccountId,
          managerActionId: input.actionId,
          actorType: input.actorType,
          actorId: input.actorId,
          operation: 'EXECUTE_ACTION',
          result: 'FAILED',
          errorCode: 'EXECUTION_FAILED',
          errorMessage: message,
          completedAt: new Date(),
        },
        tx
      );
    });
    throw error;
  }
}

export async function decideManagerAction(input: {
  companyAccountId: string;
  actionId: string;
  decision: 'APPROVED' | 'REJECTED';
  ownerId: string;
  reason?: string | null;
  editedPayload?: unknown;
}) {
  const approved = await prisma.$transaction(async (tx) => {
    const action = await tx.generalManagerAction.findFirst({
      where: {
        id: input.actionId,
        companyAccountId: input.companyAccountId,
        status: 'PENDING_APPROVAL',
      },
      include: { approval: true },
    });
    if (!action || !action.approval) {
      throw new Error('Onay bekleyen aksiyon bulunamadı.');
    }
    const parsedEditedPayload =
      input.editedPayload === undefined
        ? undefined
        : parseManagerActionPayload(action.actionType, input.editedPayload);
    const actionChanged = await tx.generalManagerAction.updateMany({
      where: {
        id: action.id,
        companyAccountId: input.companyAccountId,
        status: 'PENDING_APPROVAL',
      },
      data: {
        status:
          input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        payload: parsedEditedPayload,
        approvedAt:
          input.decision === 'APPROVED' ? new Date() : undefined,
      },
    });
    if (actionChanged.count !== 1) {
      throw new Error(
        'Bu aksiyon başka bir oturum tarafından daha önce sonuçlandırıldı.'
      );
    }
    const approvalChanged = await tx.actionApproval.updateMany({
      where: {
        actionId: action.id,
        companyAccountId: input.companyAccountId,
        decision: 'PENDING',
      },
      data: {
        decision: input.decision,
        decidedByType: 'OWNER',
        decidedById: input.ownerId,
        decisionReason: input.reason,
        editedPayload: parsedEditedPayload,
        decidedAt: new Date(),
      },
    });
    if (approvalChanged.count !== 1) {
      throw new Error(
        'Bu onay başka bir oturum tarafından daha önce sonuçlandırıldı.'
      );
    }
    await appendManagerAudit(
      {
        companyAccountId: input.companyAccountId,
        operationEventId: action.operationEventId,
        managerActionId: action.id,
        actorType: 'OWNER',
        actorId: input.ownerId,
        operation: 'DECIDE_ACTION',
        structuredAi: parsedEditedPayload,
        policyDecision: action.policyDecision,
        result: input.decision,
        completedAt: new Date(),
      },
      tx
    );
    return tx.generalManagerAction.findFirstOrThrow({
      where: {
        id: action.id,
        companyAccountId: input.companyAccountId,
      },
    });
  });
  if (approved.status === 'APPROVED') {
    return executeApprovedManagerAction({
      companyAccountId: input.companyAccountId,
      actionId: approved.id,
      actorType: 'OWNER',
      actorId: input.ownerId,
    });
  }
  return approved;
}
