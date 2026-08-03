import { prisma } from '@/lib/prisma';

import { deliveryPresentation } from './policy';
import { generateVerifiedDailyManagerSummary } from './summary';

export type DigitalManagerPrincipal =
  | { type: 'OWNER'; memberId: null }
  | { type: 'EMPLOYEE'; memberId: string };

export async function getDigitalManagerDashboard(
  companyAccountId: string,
  principal: DigitalManagerPrincipal
) {
  const owner = principal.type === 'OWNER';
  const taskWhere = owner
    ? { companyAccountId }
    : {
        companyAccountId,
        assignedMemberId: principal.memberId,
      };
  const employeeTaskIds = owner
    ? []
    : (
        await prisma.crmTask.findMany({
          where: {
            companyAccountId,
            assignedMemberId: principal.memberId,
          },
          select: { id: true },
          take: 1000,
        })
      ).map(({ id }) => id);
  const actionWhere = owner
    ? { companyAccountId }
    : {
        companyAccountId,
        OR: [
          { targetType: 'COMPANY_MEMBER', targetId: principal.memberId },
          { taskId: { in: employeeTaskIds } },
        ],
      };
  const [
    approvals,
    actions,
    tasks,
    commitments,
    deliveries,
    handoffs,
    corrections,
    preferences,
    summary,
    members,
    viewingWorkflows,
  ] = await Promise.all([
    owner
      ? prisma.generalManagerAction.findMany({
          where: {
            companyAccountId,
            status: 'PENDING_APPROVAL',
          },
          include: { approval: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : [],
    prisma.generalManagerAction.findMany({
      where: actionWhere,
      select: {
        id: true,
        actionType: true,
        reason: true,
        confidence: true,
        riskLevel: true,
        requiresApproval: true,
        policyDecision: true,
        proposedMessage: true,
        status: true,
        targetType: true,
        targetId: true,
        taskId: true,
        errorMessage: true,
        createdAt: true,
        executedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.crmTask.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        status: true,
        workflowStatus: true,
        dueAt: true,
        lastStatusAt: true,
        failureReason: true,
        assignedMember: {
          select: { id: true, name: true },
        },
        contact: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
        updatedAt: true,
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take: 100,
    }),
    prisma.operationalCommitment.findMany({
      where: owner
        ? {
            companyAccountId,
            status: { in: ['OPEN', 'OVERDUE'] },
          }
        : {
            companyAccountId,
            memberId: principal.memberId,
            status: { in: ['OPEN', 'OVERDUE'] },
          },
      select: {
        id: true,
        taskId: true,
        memberId: true,
        description: true,
        relativeTimeText: true,
        dueAt: true,
        timezone: true,
        certainty: true,
        status: true,
        reminderCount: true,
        lastReminderAt: true,
        escalatedAt: true,
        member: { select: { id: true, name: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
    }),
    prisma.whatsAppOutboxMessage.findMany({
      where: owner
        ? { companyAccountId }
        : {
            companyAccountId,
            recipientType: 'EMPLOYEE',
            recipientId: principal.memberId,
          },
      select: {
        id: true,
        recipientType: true,
        recipientId: true,
        purpose: true,
        relatedTaskId: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.conversationHandoff.findMany({
      where: owner
        ? { companyAccountId, status: { notIn: ['RETURNED', 'CANCELLED'] } }
        : {
            companyAccountId,
            assignedMemberId: principal.memberId,
            status: { notIn: ['RETURNED', 'CANCELLED'] },
          },
      select: {
        id: true,
        conversationId: true,
        assignedMemberId: true,
        status: true,
        summary: true,
        requestedAt: true,
        acceptedAt: true,
        conversation: {
          select: {
            customerName: true,
            aiEnabled: true,
            intent: true,
            summary: true,
            notes: true,
            tags: true,
          },
        },
        verifiedContext: true,
      },
      orderBy: { requestedAt: 'desc' },
      take: 30,
    }),
    owner
      ? prisma.managerAuditLog.findMany({
          where: {
            companyAccountId,
            OR: [
              { correctionOfId: { not: null } },
              { operation: { contains: 'CORRECTION' } },
            ],
          },
          select: {
            id: true,
            correctionOfId: true,
            operation: true,
            entityType: true,
            entityId: true,
            result: true,
            errorMessage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : [],
    owner
      ? prisma.managerNotificationPreference.upsert({
          where: { companyAccountId },
          update: {},
          create: { companyAccountId },
          select: {
            ownerPhone: true,
            ownerPhoneNormalized: true,
            notifyCriticalImmediately: true,
            notifyTaskAccepted: true,
            notifyOnlyProblemsAndDelays: true,
            alwaysNotifyHotLeads: true,
            hourlySummaryEnabled: true,
            morningSummaryEnabled: true,
            eveningSummaryEnabled: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
            autonomyMode: true,
            allowAutomaticEmployeeAssignment: true,
            allowAutomaticEmployeeWhatsApp: true,
          },
        })
      : null,
    owner
      ? generateVerifiedDailyManagerSummary(companyAccountId)
      : prisma.dailyManagerSummary.findFirst({
          where: { companyAccountId },
          orderBy: { periodStart: 'desc' },
          select: {
            periodStart: true,
            periodEnd: true,
            generatedText: true,
          },
        }),
    owner
      ? prisma.companyMember.findMany({
          where: {
            companyAccountId,
            active: true,
          },
          select: {
            id: true,
            name: true,
            availability: true,
            maxActiveTaskCapacity: true,
            _count: {
              select: {
                tasks: {
                  where: {
                    status: 'OPEN',
                    workflowStatus: {
                      notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ availability: 'asc' }, { name: 'asc' }],
          take: 200,
        })
      : [],
    prisma.viewingWorkflow.findMany({
      where: owner
        ? { companyAccountId }
        : {
            companyAccountId,
            crmTask: { is: { assignedMemberId: principal.memberId } },
          },
      select: {
        id: true,
        shortCode: true,
        status: true,
        startedAt: true,
        completedAt: true,
        cancelledAt: true,
        lastError: true,
        contact: { select: { id: true, name: true } },
        property: {
          select: { id: true, title: true, referenceCode: true, status: true },
        },
        crmTask: {
          select: {
            id: true,
            workflowStatus: true,
            assignedMember: { select: { id: true, name: true } },
          },
        },
        assignmentAttempts: {
          select: {
            id: true,
            sequence: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            ackDeadlineAt: true,
            answeredAt: true,
            failureReason: true,
            member: { select: { id: true, name: true } },
            outboxMessage: {
              select: { status: true, lastError: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        interactionPrompts: {
          where: { status: 'OPEN' },
          select: {
            id: true,
            promptType: true,
            expectedResponseType: true,
            shortCode: true,
            candidateMemberSnapshot: true,
            deadlineAt: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        appointmentRequests: {
          select: {
            id: true,
            shortCode: true,
            startAt: true,
            endAt: true,
            timezone: true,
            status: true,
            employeeConfirmedAt: true,
            employeeDeclinedAt: true,
            outcome: {
              select: {
                outcome: true,
                reasonText: true,
                nextAction: true,
                nextActionAt: true,
                saleDecision: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
  ]);

  return {
    role: principal.type,
    generatedAt: new Date().toISOString(),
    approvals: approvals.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      reason: action.reason,
      evidence: action.evidence,
      confidence: action.confidence,
      riskLevel: action.riskLevel,
      proposedMessage: action.proposedMessage,
      payload: action.payload,
      canMuteEvent: Boolean(action.operationEventId),
      createdAt: action.createdAt,
    })),
    actions,
    tasks,
    commitments,
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      presentation: deliveryPresentation(delivery.status),
    })),
    handoffs,
    corrections,
    preferences,
    summary,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      availability: member.availability,
      maxActiveTaskCapacity: member.maxActiveTaskCapacity,
      activeTaskCount: member._count.tasks,
    })),
    viewingWorkflows,
  };
}
