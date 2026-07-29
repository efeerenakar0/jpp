import type { GeneralManagerAction } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { selectAvailableCompanyMember } from './assignment';
import { recordOperationEvent } from './events';
import { proposeManagerAction } from './executor';

type ActionResult = GeneralManagerAction | null;

async function createdTaskForAction(
  companyAccountId: string,
  action: GeneralManagerAction
) {
  if (action.status !== 'EXECUTED') return null;
  return prisma.crmTask.findFirst({
    where: {
      companyAccountId,
      idempotencyKey: `manager-action:${action.id}`,
    },
  });
}

async function proposeEmployeeTaskMessage(input: {
  companyAccountId: string;
  operationEventId: string;
  sourceMessageId: string;
  taskId: string;
  employee: Awaited<ReturnType<typeof selectAvailableCompanyMember>>;
  message: string;
  idempotencyPrefix: string;
  requestedByType: string;
  requestedById: string;
}) {
  if (
    !input.employee ||
    input.employee.phoneVerificationStatus !== 'VERIFIED' ||
    !input.employee.canReceiveWhatsAppTasks
  ) {
    return null;
  }
  return proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: input.operationEventId,
    triggerMessageId: input.sourceMessageId,
    action: {
      actionType: 'SEND_EMPLOYEE_WHATSAPP',
      employeeId: input.employee.id,
      taskId: input.taskId,
      message: input.message,
    },
    reason:
      'Doğrulanmış operasyon olayı uygun ekip üyesine iletiliyor.',
    evidence: {
      taskId: input.taskId,
      employeeId: input.employee.id,
      sourceMessageId: input.sourceMessageId,
    },
    confidence: 1,
    riskLevel: 'LOW',
    requestedByType: input.requestedByType,
    requestedById: input.requestedById,
    idempotencyKey: `${input.idempotencyPrefix}:employee-whatsapp`,
  });
}

async function proposeOwnerAlert(input: {
  companyAccountId: string;
  operationEventId: string;
  sourceMessageId: string;
  message: string;
  important?: boolean;
  idempotencyPrefix: string;
  requestedByType: string;
  requestedById: string;
}) {
  return proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: input.operationEventId,
    triggerMessageId: input.sourceMessageId,
    action: {
      actionType: 'NOTIFY_OWNER',
      message: input.message,
      important: input.important !== false,
    },
    reason: 'Patronun doğrulanmış olay için bilgilendirilmesi gerekiyor.',
    evidence: {
      operationEventId: input.operationEventId,
      sourceMessageId: input.sourceMessageId,
    },
    confidence: 1,
    riskLevel: 'LOW',
    requestedByType: input.requestedByType,
    requestedById: input.requestedById,
    idempotencyKey: `${input.idempotencyPrefix}:owner-alert`,
  });
}

export async function orchestratePropertyOwnerInterest(input: {
  companyAccountId: string;
  operationEventId: string;
  listingId: string;
  listingTitle: string;
  location?: string | null;
  ownerMessage: string;
  ownerClaimedConfirmation: boolean;
  providerMessageId: string;
}) {
  const employee = await selectAvailableCompanyMember({
    companyAccountId: input.companyAccountId,
    region: input.location,
  });
  const prefix = `authorization:${input.operationEventId}`;
  const taskAction = await proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: input.operationEventId,
    triggerMessageId: input.providerMessageId,
    action: {
      actionType: 'CREATE_TASK',
      title: input.ownerClaimedConfirmation
        ? `Yetki beyanını doğrula: ${input.listingTitle}`
        : `Portföy sahibiyle yetki görüşmesi: ${input.listingTitle}`,
      description: `Malik mesajı: ${input.ownerMessage.slice(0, 1500)}`,
      taskType: 'FOLLOW_UP',
      contactId: null,
      propertyId: null,
      assignedMemberId: employee?.id || null,
      dueAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      priority: input.ownerClaimedConfirmation ? 5 : 4,
    },
    reason:
      'Portföy sahibi yetki süreci için insan takibi gerektiren bir mesaj gönderdi.',
    evidence: {
      listingId: input.listingId,
      sourceMessageId: input.providerMessageId,
      claimedConfirmation: input.ownerClaimedConfirmation,
      selectedEmployeeId: employee?.id || null,
    },
    confidence: 1,
    riskLevel: 'LOW',
    requestedByType: 'PROPERTY_OWNER',
    requestedById: input.listingId,
    idempotencyKey: `${prefix}:task`,
  });
  const task = await createdTaskForAction(
    input.companyAccountId,
    taskAction
  );
  const activityAction = await proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: input.operationEventId,
    triggerMessageId: input.providerMessageId,
    action: {
      actionType: 'CREATE_CRM_ACTIVITY',
      contactId: null,
      propertyId: null,
      dealId: null,
      activityType: 'AUTHORIZATION_INTEREST',
      title: input.ownerClaimedConfirmation
        ? 'Malik yetki verdiğini beyan etti'
        : 'Malik yetki görüşmesi istiyor',
      description: `${input.listingTitle}: ${input.ownerMessage.slice(0, 1500)}`,
    },
    reason: 'Malik mesajı şirket operasyon geçmişine kaydediliyor.',
    evidence: {
      listingId: input.listingId,
      sourceMessageId: input.providerMessageId,
    },
    confidence: 1,
    riskLevel: 'LOW',
    requestedByType: 'PROPERTY_OWNER',
    requestedById: input.listingId,
    idempotencyKey: `${prefix}:activity`,
  });
  const employeeWhatsAppAction =
    task && employee
      ? await proposeEmployeeTaskMessage({
          companyAccountId: input.companyAccountId,
          operationEventId: input.operationEventId,
          sourceMessageId: input.providerMessageId,
          taskId: task.id,
          employee,
          message: input.ownerClaimedConfirmation
            ? `Önemli: “${input.listingTitle}” ilanının maliki yetki verdiğini beyan etti. Bu henüz kesin onay değildir. Sözleşmeyi ve ilan bilgilerini doğrulayıp sonucu görevden bildir.`
            : `“${input.listingTitle}” ilanının maliki yetki sürecini görüşmek istiyor. Malik mesajını inceleyip şartları netleştir ve sonucu görevden bildir.`,
          idempotencyPrefix: prefix,
          requestedByType: 'PROPERTY_OWNER',
          requestedById: input.listingId,
        })
      : null;
  const ownerAlertAction = await proposeOwnerAlert({
    companyAccountId: input.companyAccountId,
    operationEventId: input.operationEventId,
    sourceMessageId: input.providerMessageId,
    message: `${input.listingTitle} için malik ${
      input.ownerClaimedConfirmation
        ? 'yetki verdiğini beyan etti; insan doğrulaması bekleniyor'
        : 'yetki görüşmesi istiyor'
    }. ${
      employee
        ? `Takip için ${employee.name} seçildi.`
        : 'Uygun çalışan bulunamadı; atama gerekiyor.'
    }`,
    idempotencyPrefix: prefix,
    requestedByType: 'PROPERTY_OWNER',
    requestedById: input.listingId,
  });
  return {
    employee,
    taskAction,
    task,
    activityAction,
    employeeWhatsAppAction,
    ownerAlertAction,
  };
}

export async function orchestrateCustomerViewingRequest(input: {
  companyAccountId: string;
  conversationId: string;
  contactId: string;
  customerName: string;
  customerMessage: string;
  provider: string;
  providerMessageId: string;
  location?: string | null;
  appointmentRequestId: string;
}) {
  const viewingEvent = await recordOperationEvent({
    companyAccountId: input.companyAccountId,
    eventType: 'VIEWING_REQUESTED',
    entityType: 'CUSTOMER_CONVERSATION',
    entityId: input.conversationId,
    actorType: 'CRM_CONTACT',
    actorId: input.contactId,
    contactId: input.contactId,
    conversationId: input.conversationId,
    sourceProvider: input.provider,
    sourceMessageId: input.providerMessageId,
    metadata: {
      appointmentRequestId: input.appointmentRequestId,
      untrustedText: input.customerMessage.slice(0, 2000),
    },
    idempotencyKey: `viewing:${input.provider}:${input.providerMessageId}`,
  });
  const hotLeadEvent = await recordOperationEvent({
    companyAccountId: input.companyAccountId,
    eventType: 'HOT_LEAD_DETECTED',
    entityType: 'CRM_CONTACT',
    entityId: input.contactId,
    actorType: 'RULE_ENGINE',
    actorId: 'viewing-request-detector',
    contactId: input.contactId,
    conversationId: input.conversationId,
    sourceProvider: input.provider,
    sourceMessageId: input.providerMessageId,
    metadata: {
      reason: 'Müşteri gösterim veya randevu talep etti.',
      appointmentRequestId: input.appointmentRequestId,
    },
    idempotencyKey: `hot-lead:${input.provider}:${input.providerMessageId}`,
  });
  const employee = await selectAvailableCompanyMember({
    companyAccountId: input.companyAccountId,
    region: input.location,
  });
  const prefix = `viewing:${viewingEvent.id}`;
  const taskAction = await proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: viewingEvent.id,
    triggerMessageId: input.providerMessageId,
    action: {
      actionType: 'CREATE_TASK',
      title: `Gösterim talebini ara: ${input.customerName}`,
      description: `Müşteri mesajı: ${input.customerMessage.slice(0, 1500)}`,
      taskType: 'VIEWING',
      contactId: input.contactId,
      propertyId: null,
      assignedMemberId: employee?.id || null,
      dueAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      priority: 5,
    },
    reason:
      'Doğrulanmış müşteri gösterim talebi hızlı insan takibi gerektiriyor.',
    evidence: {
      appointmentRequestId: input.appointmentRequestId,
      conversationId: input.conversationId,
      sourceMessageId: input.providerMessageId,
      selectedEmployeeId: employee?.id || null,
    },
    confidence: 1,
    riskLevel: 'LOW',
    requestedByType: 'CRM_CONTACT',
    requestedById: input.contactId,
    idempotencyKey: `${prefix}:task`,
  });
  const task = await createdTaskForAction(
    input.companyAccountId,
    taskAction
  );
  const [stageAction, activityAction] = await Promise.all([
    proposeManagerAction({
      companyAccountId: input.companyAccountId,
      operationEventId: viewingEvent.id,
      triggerMessageId: input.providerMessageId,
      action: {
        actionType: 'UPDATE_LEAD_STAGE',
        contactId: input.contactId,
        stage: 'VIEWING',
      },
      reason: 'Gösterim isteyen müşteri sıcak lead olarak işaretleniyor.',
      evidence: {
        appointmentRequestId: input.appointmentRequestId,
        hotLeadEventId: hotLeadEvent.id,
      },
      confidence: 1,
      riskLevel: 'LOW',
      requestedByType: 'CRM_CONTACT',
      requestedById: input.contactId,
      idempotencyKey: `${prefix}:lead-stage`,
    }),
    proposeManagerAction({
      companyAccountId: input.companyAccountId,
      operationEventId: viewingEvent.id,
      triggerMessageId: input.providerMessageId,
      action: {
        actionType: 'CREATE_CRM_ACTIVITY',
        contactId: input.contactId,
        propertyId: null,
        dealId: null,
        activityType: 'VIEWING_REQUESTED',
        title: 'WhatsApp üzerinden gösterim talebi',
        description: input.customerMessage.slice(0, 1500),
      },
      reason: 'Gösterim talebi CRM geçmişine kaydediliyor.',
      evidence: {
        appointmentRequestId: input.appointmentRequestId,
        conversationId: input.conversationId,
      },
      confidence: 1,
      riskLevel: 'LOW',
      requestedByType: 'CRM_CONTACT',
      requestedById: input.contactId,
      idempotencyKey: `${prefix}:activity`,
    }),
  ]);
  const employeeWhatsAppAction =
    task && employee
      ? await proposeEmployeeTaskMessage({
          companyAccountId: input.companyAccountId,
          operationEventId: viewingEvent.id,
          sourceMessageId: input.providerMessageId,
          taskId: task.id,
          employee,
          message: `${input.customerName} WhatsApp üzerinden gösterim/randevu talep etti. Mesaj: “${input.customerMessage.slice(
            0,
            600
          )}” Müşteriyi arayıp uygun saat ve portföyü doğrula; henüz kesin randevu sözü verme.`,
          idempotencyPrefix: prefix,
          requestedByType: 'CRM_CONTACT',
          requestedById: input.contactId,
        })
      : null;
  const handoffAction = await proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: viewingEvent.id,
    triggerMessageId: input.providerMessageId,
    action: {
      actionType: 'OFFER_CONVERSATION_HANDOFF',
      conversationId: input.conversationId,
      employeeId: employee?.id || null,
      summary: `${input.customerName} gösterim istiyor. İhtiyaç: ${input.customerMessage.slice(
        0,
        900
      )}. Önerilen sonraki adım: müşteri aranarak portföy ve saat doğrulansın; kesin randevu insan onayı olmadan verilmesin.`,
    },
    reason: 'Sıcak müşteri konuşmasının insana devri öneriliyor.',
    evidence: {
      hotLeadEventId: hotLeadEvent.id,
      appointmentRequestId: input.appointmentRequestId,
      employeeId: employee?.id || null,
    },
    confidence: 1,
    riskLevel: 'HIGH',
    requestedByType: 'CRM_CONTACT',
    requestedById: input.contactId,
    idempotencyKey: `${prefix}:handoff`,
  });
  const ownerAlertAction = await proposeOwnerAlert({
    companyAccountId: input.companyAccountId,
    operationEventId: hotLeadEvent.id,
    sourceMessageId: input.providerMessageId,
    message: `${input.customerName} gösterim/randevu talep etti. ${
      employee
        ? `Takip için ${employee.name} seçildi.`
        : 'Uygun çalışan bulunamadı; hızlı atama gerekiyor.'
    }`,
    idempotencyPrefix: prefix,
    requestedByType: 'CRM_CONTACT',
    requestedById: input.contactId,
  });
  return {
    viewingEvent,
    hotLeadEvent,
    employee,
    taskAction,
    task,
    stageAction,
    activityAction,
    employeeWhatsAppAction,
    handoffAction,
    ownerAlertAction,
  };
}

export type LeadOrchestrationResult = Awaited<
  ReturnType<typeof orchestrateCustomerViewingRequest>
>;

export type OptionalActionResult = ActionResult;
