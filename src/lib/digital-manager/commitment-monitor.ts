import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { prisma } from '@/lib/prisma';
import { getCompanyOperationalStatus } from './company-guard';

import { proposeManagerAction } from './executor';
import { recordOperationEvent } from './events';
import { shouldNotifyOwnerNow } from './policy';
import { generateVerifiedDailyManagerSummary } from './summary';
import { dueCommitmentDecision } from './workflow';

export async function processDueOperationalCommitments(now = new Date()) {
  const commitments = await prisma.operationalCommitment.findMany({
    where: {
      status: { in: ['OPEN', 'OVERDUE'] },
      dueAt: { not: null, lte: now },
    },
    include: {
      member: {
        select: {
          id: true,
          name: true,
          phoneNormalized: true,
          canReceiveWhatsAppTasks: true,
        },
      },
      task: { select: { id: true, title: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 500,
  });
  const results: Array<{
    commitmentId: string;
    decision: string;
    actionStatus?: string;
  }> = [];

  for (const commitment of commitments) {
    if (!commitment.dueAt) continue;
    const operational = await getCompanyOperationalStatus(
      commitment.companyAccountId
    );
    if (!operational.allowed) {
      results.push({
        commitmentId: commitment.id,
        decision: `SKIPPED_${operational.reason}`,
      });
      continue;
    }
    const decision = dueCommitmentDecision({
      dueAt: commitment.dueAt.toISOString(),
      now: now.toISOString(),
      reminderCount: commitment.reminderCount,
      lastReminderAt: commitment.lastReminderAt?.toISOString() || null,
      status: commitment.status,
    });
    if (decision === 'NO_ACTION') continue;

    const event = await recordOperationEvent({
      companyAccountId: commitment.companyAccountId,
      eventType: 'COMMITMENT_OVERDUE',
      entityType: 'OPERATIONAL_COMMITMENT',
      entityId: commitment.id,
      actorType: 'SCHEDULER',
      actorId: 'digital-manager-commitment-monitor',
      taskId: commitment.taskId,
      metadata: {
        dueAt: commitment.dueAt.toISOString(),
        reminderCount: commitment.reminderCount,
        decision,
      },
      occurredAt: now,
      idempotencyKey: `commitment:${commitment.id}:overdue`,
    });
    await prisma.operationalCommitment.updateMany({
      where: {
        id: commitment.id,
        companyAccountId: commitment.companyAccountId,
        status: 'OPEN',
      },
      data: { status: 'OVERDUE' },
    });

    if (decision === 'REMIND_EMPLOYEE') {
      if (
        !commitment.member ||
        !commitment.member.phoneNormalized ||
        !commitment.member.canReceiveWhatsAppTasks
      ) {
        await createCompanyNotification({
          companyAccountId: commitment.companyAccountId,
          type: 'SYSTEM',
          title: 'Taahhüt gecikti',
          message: `${
            commitment.member?.name || 'Atanmamış çalışan'
          } için görev telefonu bulunamadı: ${commitment.description}`,
          link: '/fabrika',
          important: true,
          dedupeKey: `commitment:${commitment.id}:missing-phone`,
          metadata: {
            commitmentId: commitment.id,
            taskId: commitment.taskId,
          },
        });
        results.push({ commitmentId: commitment.id, decision });
        continue;
      }
      const action = await proposeManagerAction({
        companyAccountId: commitment.companyAccountId,
        operationEventId: event.id,
        action: {
          actionType: 'SEND_EMPLOYEE_WHATSAPP',
          employeeId: commitment.member.id,
          taskId: commitment.taskId,
          message: `Hatırlatma: “${commitment.description}” taahhüdünün süresi doldu. Güncel durumu ve somut sonucu yanıtlar mısın?`,
        },
        reason: 'Doğrulanmış çalışan taahhüdünün süresi doldu.',
        evidence: {
          commitmentId: commitment.id,
          dueAt: commitment.dueAt.toISOString(),
          taskId: commitment.taskId,
        },
        confidence: commitment.certainty,
        riskLevel: 'LOW',
        requestedByType: 'SCHEDULER',
        requestedById: 'digital-manager-commitment-monitor',
        idempotencyKey: `commitment:${commitment.id}:reminder:1`,
      });
      if (action.status === 'EXECUTED') {
        await prisma.operationalCommitment.updateMany({
          where: {
            id: commitment.id,
            companyAccountId: commitment.companyAccountId,
            reminderCount: 0,
          },
          data: {
            status: 'OVERDUE',
            reminderCount: 1,
            lastReminderAt: now,
          },
        });
      } else if (action.status === 'PENDING_APPROVAL') {
        await createCompanyNotification({
          companyAccountId: commitment.companyAccountId,
          type: 'SYSTEM',
          title: 'Taahhüt hatırlatması onay bekliyor',
          message: `${commitment.member.name}: ${commitment.description}`,
          link: '/fabrika',
          important: true,
          dedupeKey: `commitment:${commitment.id}:reminder-approval`,
          metadata: {
            commitmentId: commitment.id,
            managerActionId: action.id,
          },
        });
      }
      results.push({
        commitmentId: commitment.id,
        decision,
        actionStatus: action.status,
      });
      continue;
    }

    const action = await proposeManagerAction({
      companyAccountId: commitment.companyAccountId,
      operationEventId: event.id,
      action: {
        actionType: 'NOTIFY_OWNER',
        message: `${commitment.member?.name || 'Ekip üyesi'} “${
          commitment.description
        }” taahhüdünü zamanında tamamlamadı. Görev: ${
          commitment.task?.title || 'bağlı görev yok'
        }.`,
        important: true,
      },
      reason:
        'İlk hatırlatmadan sonra taahhüt gecikmesi devam ettiği için patron müdahalesi gerekiyor.',
      evidence: {
        commitmentId: commitment.id,
        reminderCount: commitment.reminderCount,
        lastReminderAt: commitment.lastReminderAt?.toISOString() || null,
      },
      confidence: 1,
      riskLevel: 'LOW',
      requestedByType: 'SCHEDULER',
      requestedById: 'digital-manager-commitment-monitor',
      idempotencyKey: `commitment:${commitment.id}:owner-escalation`,
    });
    await createCompanyNotification({
      companyAccountId: commitment.companyAccountId,
      type: 'SYSTEM',
      title: 'Geciken taahhüt müdahale bekliyor',
      message: `${commitment.member?.name || 'Ekip üyesi'}: ${
        commitment.description
      }`,
      link: '/fabrika',
      important: true,
      dedupeKey: `commitment:${commitment.id}:owner-escalation`,
      metadata: {
        commitmentId: commitment.id,
        managerActionId: action.id,
      },
    });
    if (action.status === 'EXECUTED') {
      await prisma.operationalCommitment.updateMany({
        where: {
          id: commitment.id,
          companyAccountId: commitment.companyAccountId,
          escalatedAt: null,
        },
        data: { escalatedAt: now },
      });
    }
    results.push({
      commitmentId: commitment.id,
      decision,
      actionStatus: action.status,
    });
  }
  return results;
}

export async function generateActiveCompanyDailySummaries(now = new Date()) {
  const accounts = await prisma.companyAccount.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      ownerPhoneNormalized: true,
    },
    take: 1000,
  });
  const summaries = [];
  for (const account of accounts) {
    const operational = await getCompanyOperationalStatus(account.id);
    if (!operational.allowed) continue;
    const [summary, preference, config] = await Promise.all([
      generateVerifiedDailyManagerSummary(account.id, now),
      prisma.managerNotificationPreference.upsert({
        where: { companyAccountId: account.id },
        update: {},
        create: { companyAccountId: account.id },
      }),
      prisma.whatsAppConfig.findUnique({
        where: { companyAccountId: account.id },
        select: { connectedPhone: true },
      }),
    ]);
    summaries.push(summary);
    const hourText = new Intl.DateTimeFormat('en-US', {
      timeZone: preference.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    const localHour = Number(hourText);
    const summarySlot =
      preference.hourlySummaryEnabled
        ? `hour-${localHour}`
        : preference.morningSummaryEnabled && localHour === 8
          ? 'morning'
          : preference.eveningSummaryEnabled && localHour === 18
            ? 'evening'
            : null;
    const notifyNow = shouldNotifyOwnerNow(
      {
        importance: 'NORMAL',
        eventType: 'MANAGER_SUMMARY',
      },
      {
        autonomyMode: preference.autonomyMode,
        allowAutomaticEmployeeAssignment:
          preference.allowAutomaticEmployeeAssignment,
        allowAutomaticEmployeeWhatsApp:
          preference.allowAutomaticEmployeeWhatsApp,
        notifyCriticalImmediately: preference.notifyCriticalImmediately,
        notifyTaskAccepted: preference.notifyTaskAccepted,
        notifyOnlyProblemsAndDelays:
          preference.notifyOnlyProblemsAndDelays,
        alwaysNotifyHotLeads: preference.alwaysNotifyHotLeads,
        quietHoursEnabled: preference.quietHoursEnabled,
        quietHoursStart: preference.quietHoursStart,
        quietHoursEnd: preference.quietHoursEnd,
        timezone: preference.timezone,
      },
      now
    );
    const ownerPhone =
      preference.ownerPhoneNormalized || account.ownerPhoneNormalized || null;
    const normalizedOwnerPhone = ownerPhone?.replace(/\D/g, '') || null;
    const normalizedConnectedPhone =
      config?.connectedPhone?.replace(/\D/g, '') || null;
    if (
      summarySlot &&
      notifyNow &&
      normalizedOwnerPhone &&
      normalizedOwnerPhone !== normalizedConnectedPhone
    ) {
      const outbox = await queueCompanyWhatsAppMessage({
        companyAccountId: account.id,
        to: normalizedOwnerPhone,
        text: `Dijital Genel Müdür özeti\n\n${summary.generatedText}`,
        recipientType: 'OWNER',
        recipientId: account.id,
        purpose: 'MANAGER_SUMMARY',
        idempotencyKey: `manager-summary:${summary.periodStart.toISOString()}:${summarySlot}`,
        createdByType: 'DIGITAL_GENERAL_MANAGER',
        metadata: {
          summaryId: summary.id,
          periodStart: summary.periodStart.toISOString(),
          periodEnd: summary.periodEnd.toISOString(),
          slot: summarySlot,
        },
      });
      await prisma.dailyManagerSummary.update({
        where: { id: summary.id },
        data: {
          deliveryStatus:
            outbox.deliveryStatus === 'FAILED' ? 'FAILED' : 'QUEUED',
        },
      });
    }
  }
  return summaries;
}
