import type { GeneralManagerAction } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { selectAvailableCompanyMember } from './assignment';
import { proposeManagerAction } from './executor';
import { createViewingWorkflow } from '@/lib/viewing-workflow/service';

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
    !input.employee.phoneNormalized ||
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
      'Operasyon olayı uygun ekip üyesine iletiliyor.',
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
  propertyId: string;
  customerName: string;
  customerMessage: string;
  provider: string;
  providerMessageId: string;
  location?: string | null;
  appointmentRequestId: string;
  now?: Date;
}) {
  if (!input.propertyId) {
    throw new Error(
      'Gösterim görevi kesin bir tenant portföyü olmadan oluşturulamaz.'
    );
  }
  const employee = await selectAvailableCompanyMember({
    companyAccountId: input.companyAccountId,
    region: input.location,
    now: input.now,
  });
  return createViewingWorkflow({
    companyAccountId: input.companyAccountId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    propertyId: input.propertyId,
    appointmentRequestId: input.appointmentRequestId,
    provider: input.provider,
    providerMessageId: input.providerMessageId,
    customerMessage: input.customerMessage,
    assignedMemberId: employee?.id || null,
    now: input.now,
  });
}

export type LeadOrchestrationResult = Awaited<
  ReturnType<typeof orchestrateCustomerViewingRequest>
>;

export type OptionalActionResult = ActionResult;
