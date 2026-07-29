import { prisma } from '@/lib/prisma';

import {
  summarizeVerifiedFacts,
  type VerifiedManagerFacts,
} from './workflow';

export function istanbulDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  const start = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      -3
    )
  );
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

async function exactCountWhenSampleIsFull(
  sampleLength: number,
  sampleLimit: number,
  count: () => Promise<number>
) {
  return sampleLength < sampleLimit ? sampleLength : count();
}

export async function generateVerifiedDailyManagerSummary(
  companyAccountId: string,
  now = new Date()
) {
  const { start, end } = istanbulDayBounds(now);
  const [
    newContacts,
    hotContacts,
    newProperties,
    authorizationEvents,
    viewingEvents,
    openTasks,
    completedTransitions,
    overdueCommitments,
    failedDeliveries,
    pendingApprovals,
    employees,
  ] = await Promise.all([
    prisma.crmContact.findMany({
      where: {
        companyAccountId,
        createdAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.crmContact.findMany({
      where: {
        companyAccountId,
        stage: { in: ['QUALIFIED', 'VIEWING', 'OFFER'] },
        updatedAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.crmProperty.findMany({
      where: {
        companyAccountId,
        createdAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.operationEvent.findMany({
      where: {
        companyAccountId,
        eventType: {
          in: ['AUTHORIZATION_INTEREST', 'AUTHORIZATION_CONFIRMED'],
        },
        occurredAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.operationEvent.findMany({
      where: {
        companyAccountId,
        eventType: 'APPOINTMENT_CONFIRMED',
        occurredAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.crmTask.findMany({
      where: {
        companyAccountId,
        status: 'OPEN',
        workflowStatus: {
          notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
        },
      },
      select: { id: true },
      take: 1000,
    }),
    prisma.taskStatusTransition.findMany({
      where: {
        companyAccountId,
        toStatus: 'COMPLETED',
        createdAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.operationalCommitment.findMany({
      where: {
        companyAccountId,
        status: { in: ['OPEN', 'OVERDUE'] },
        dueAt: { lt: now },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.whatsAppOutboxMessage.findMany({
      where: {
        companyAccountId,
        status: 'FAILED',
        failedAt: { gte: start, lt: end },
      },
      select: { id: true },
      take: 500,
    }),
    prisma.actionApproval.findMany({
      where: { companyAccountId, decision: 'PENDING' },
      select: { id: true },
      take: 500,
    }),
    prisma.companyMember.findMany({
      where: {
        companyAccountId,
        active: true,
      },
      select: {
        name: true,
        availability: true,
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
      orderBy: { name: 'asc' },
      take: 100,
    }),
  ]);

  const [
    newCustomerCount,
    hotCustomerCount,
    newPropertyCount,
    authorizationInterestCount,
    confirmedViewingCount,
    openTaskCount,
    completedTaskCount,
    overdueCommitmentCount,
    deliveryFailureCount,
    pendingApprovalCount,
  ] = await Promise.all([
    exactCountWhenSampleIsFull(newContacts.length, 500, () =>
      prisma.crmContact.count({
        where: {
          companyAccountId,
          createdAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(hotContacts.length, 500, () =>
      prisma.crmContact.count({
        where: {
          companyAccountId,
          stage: { in: ['QUALIFIED', 'VIEWING', 'OFFER'] },
          updatedAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(newProperties.length, 500, () =>
      prisma.crmProperty.count({
        where: {
          companyAccountId,
          createdAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(authorizationEvents.length, 500, () =>
      prisma.operationEvent.count({
        where: {
          companyAccountId,
          eventType: {
            in: ['AUTHORIZATION_INTEREST', 'AUTHORIZATION_CONFIRMED'],
          },
          occurredAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(viewingEvents.length, 500, () =>
      prisma.operationEvent.count({
        where: {
          companyAccountId,
          eventType: 'APPOINTMENT_CONFIRMED',
          occurredAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(openTasks.length, 1000, () =>
      prisma.crmTask.count({
        where: {
          companyAccountId,
          status: 'OPEN',
          workflowStatus: {
            notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
          },
        },
      })
    ),
    exactCountWhenSampleIsFull(completedTransitions.length, 500, () =>
      prisma.taskStatusTransition.count({
        where: {
          companyAccountId,
          toStatus: 'COMPLETED',
          createdAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(overdueCommitments.length, 500, () =>
      prisma.operationalCommitment.count({
        where: {
          companyAccountId,
          status: { in: ['OPEN', 'OVERDUE'] },
          dueAt: { lt: now },
        },
      })
    ),
    exactCountWhenSampleIsFull(failedDeliveries.length, 500, () =>
      prisma.whatsAppOutboxMessage.count({
        where: {
          companyAccountId,
          status: 'FAILED',
          failedAt: { gte: start, lt: end },
        },
      })
    ),
    exactCountWhenSampleIsFull(pendingApprovals.length, 500, () =>
      prisma.actionApproval.count({
        where: { companyAccountId, decision: 'PENDING' },
      })
    ),
  ]);

  const evidenceIds = [
    ...newContacts.map(({ id }) => `contact:${id}`),
    ...hotContacts.map(({ id }) => `hot-contact:${id}`),
    ...newProperties.map(({ id }) => `property:${id}`),
    ...authorizationEvents.map(({ id }) => `event:${id}`),
    ...viewingEvents.map(({ id }) => `event:${id}`),
    ...completedTransitions.map(({ id }) => `transition:${id}`),
    ...overdueCommitments.map(({ id }) => `commitment:${id}`),
    ...failedDeliveries.map(({ id }) => `delivery:${id}`),
    ...pendingApprovals.map(({ id }) => `approval:${id}`),
  ].slice(0, 1000);
  const nextActions = [
    overdueCommitmentCount > 0
      ? `${overdueCommitmentCount} süresi geçen taahhüdü sonuçlandırın.`
      : null,
    deliveryFailureCount > 0
      ? `${deliveryFailureCount} başarısız WhatsApp gönderimini inceleyin.`
      : null,
    pendingApprovalCount > 0
      ? `${pendingApprovalCount} patron onayını kararlaştırın.`
      : null,
    hotCustomerCount > 0
      ? `${hotCustomerCount} sıcak müşterinin sonraki temasını planlayın.`
      : null,
  ].filter((value): value is string => Boolean(value));
  const facts: VerifiedManagerFacts = {
    newCustomers: newCustomerCount,
    hotCustomers: hotCustomerCount,
    newProperties: newPropertyCount,
    authorizationInterests: authorizationInterestCount,
    confirmedViewings: confirmedViewingCount,
    openTasks: openTaskCount,
    completedTasks: completedTaskCount,
    overdueCommitments: overdueCommitmentCount,
    deliveryFailures: deliveryFailureCount,
    pendingApprovals: pendingApprovalCount,
    employeeStatuses: employees.map((employee) => ({
      name: employee.name,
      availability: employee.availability,
      openTasks: employee._count.tasks,
    })),
    nextActions,
    evidenceIds,
  };
  const generated = summarizeVerifiedFacts(facts);

  return prisma.dailyManagerSummary.upsert({
    where: {
      companyAccountId_periodStart_periodEnd: {
        companyAccountId,
        periodStart: start,
        periodEnd: end,
      },
    },
    update: {
      facts,
      evidenceIds: generated.evidenceIds,
      generatedText: generated.text,
      selectionReason:
        'Yalnız doğrulanmış CRM, görev, olay, taahhüt, onay ve teslimat kayıtları kullanıldı.',
    },
    create: {
      companyAccountId,
      periodStart: start,
      periodEnd: end,
      facts,
      evidenceIds: generated.evidenceIds,
      selectionReason:
        'Yalnız doğrulanmış CRM, görev, olay, taahhüt, onay ve teslimat kayıtları kullanıldı.',
      generatedText: generated.text,
    },
  });
}
