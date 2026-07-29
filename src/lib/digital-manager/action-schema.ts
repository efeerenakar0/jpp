import { z } from 'zod';

const nullableId = z.string().min(1).nullable().optional();
const optionalText = z.string().trim().min(1).max(2000).optional();

export const managerExecutableActionSchema = z.discriminatedUnion(
  'actionType',
  [
    z
      .object({
        actionType: z.literal('CREATE_TASK'),
        title: z.string().trim().min(2).max(240),
        description: optionalText,
        taskType: z
          .enum([
            'CALL',
            'MESSAGE',
            'MEETING',
            'VIEWING',
            'FOLLOW_UP',
            'DOCUMENT',
            'OTHER',
          ])
          .default('FOLLOW_UP'),
        contactId: nullableId,
        propertyId: nullableId,
        assignedMemberId: nullableId,
        dueAt: z.string().datetime().nullable().optional(),
        priority: z.number().int().min(1).max(5).default(2),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('ASSIGN_EMPLOYEE'),
        taskId: z.string().min(1),
        employeeId: z.string().min(1),
        reason: z.string().trim().min(2).max(1000),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('REASSIGN_EMPLOYEE'),
        taskId: z.string().min(1),
        employeeId: z.string().min(1),
        reason: z.string().trim().min(2).max(1000),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('UPDATE_TASK_STATUS'),
        taskId: z.string().min(1),
        status: z.enum([
          'ACCEPTED',
          'IN_PROGRESS',
          'WAITING_CUSTOMER',
          'APPOINTMENT_PROPOSED',
          'APPOINTMENT_CONFIRMED',
          'COMPLETED',
          'REJECTED',
          'REASSIGNMENT_REQUIRED',
          'CANCELLED',
          'FAILED',
        ]),
        evidenceText: z.string().trim().min(1).max(2000),
        sourceMessageId: z.string().min(1).optional(),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('CREATE_COMMITMENT'),
        taskId: nullableId,
        employeeId: nullableId,
        contactId: nullableId,
        propertyId: nullableId,
        description: z.string().trim().min(2).max(1000),
        dueAt: z.string().datetime().nullable().optional(),
        relativeTimeText: z.string().max(100).nullable().optional(),
        sourceMessageId: z.string().min(1).optional(),
        certainty: z.number().min(0).max(1).default(1),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('CREATE_CRM_ACTIVITY'),
        contactId: nullableId,
        propertyId: nullableId,
        dealId: nullableId,
        activityType: z.string().trim().min(1).max(80),
        title: z.string().trim().min(2).max(240),
        description: optionalText,
      })
      .strict(),
    z
      .object({
        actionType: z.literal('UPDATE_LEAD_STAGE'),
        contactId: z.string().min(1),
        stage: z.enum([
          'NEW',
          'CONTACTED',
          'QUALIFIED',
          'VIEWING',
          'OFFER',
          'WON',
          'LOST',
        ]),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('SEND_EMPLOYEE_WHATSAPP'),
        employeeId: z.string().min(1),
        taskId: nullableId,
        message: z.string().trim().min(1).max(1500),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('NOTIFY_OWNER'),
        message: z.string().trim().min(1).max(1500),
        important: z.boolean().default(true),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('OFFER_CONVERSATION_HANDOFF'),
        conversationId: z.string().min(1),
        employeeId: nullableId,
        summary: z.string().trim().min(2).max(2000),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('SCHEDULE_APPOINTMENT'),
        title: z.string().trim().min(2).max(240),
        contactId: nullableId,
        propertyId: nullableId,
        assignedMemberId: nullableId,
        startAt: z.string().datetime(),
        endAt: z.string().datetime().nullable().optional(),
        confirmed: z.boolean().default(false),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('ASK_CLARIFICATION'),
        question: z.string().trim().min(2).max(1000),
        recipientType: z.enum(['OWNER', 'EMPLOYEE']),
        recipientId: z.string().min(1),
      })
      .strict(),
    z
      .object({
        actionType: z.literal('CREATE_POLICY'),
        scope: z.enum([
          'ONE_TIME',
          'CONVERSATION',
          'TEMPORARY',
          'PERMANENT',
        ]),
        instruction: z.string().trim().min(5).max(2000),
        conversationId: nullableId,
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .strict(),
    z.object({ actionType: z.literal('NO_ACTION') }).strict(),
  ]
);

export type ManagerExecutableAction = z.infer<
  typeof managerExecutableActionSchema
>;

export type ManagerActionCandidateIds = {
  accountId: string;
  memberIds: string[];
  taskIds: string[];
  contactIds: string[];
  propertyIds: string[];
  dealIds: string[];
  conversationIds: string[];
};

function assertCandidate(
  value: string | null | undefined,
  candidates: string[],
  label: string
) {
  if (value && !candidates.includes(value)) {
    throw new Error(`${label} yalnızca doğrulanmış aday kayıtlardan seçilebilir.`);
  }
}

export function validateManagerActionCandidates(
  action: ManagerExecutableAction,
  candidates: ManagerActionCandidateIds
) {
  if ('employeeId' in action) {
    assertCandidate(action.employeeId, candidates.memberIds, 'Çalışan');
  }
  if ('assignedMemberId' in action) {
    assertCandidate(
      action.assignedMemberId,
      candidates.memberIds,
      'Atanan çalışan'
    );
  }
  if ('taskId' in action) {
    assertCandidate(action.taskId, candidates.taskIds, 'Görev');
  }
  if ('contactId' in action) {
    assertCandidate(action.contactId, candidates.contactIds, 'Müşteri');
  }
  if ('propertyId' in action) {
    assertCandidate(action.propertyId, candidates.propertyIds, 'Portföy');
  }
  if ('dealId' in action) {
    assertCandidate(action.dealId, candidates.dealIds, 'Satış fırsatı');
  }
  if ('conversationId' in action) {
    assertCandidate(
      action.conversationId,
      candidates.conversationIds,
      'Sohbet'
    );
  }
  if (
    action.actionType === 'ASK_CLARIFICATION' &&
    action.recipientType === 'OWNER' &&
    action.recipientId !== candidates.accountId
  ) {
    throw new Error('Patron kimliği doğrulanmış şirket hesabıyla eşleşmiyor.');
  }
  if (
    action.actionType === 'ASK_CLARIFICATION' &&
    action.recipientType === 'EMPLOYEE'
  ) {
    assertCandidate(action.recipientId, candidates.memberIds, 'Çalışan');
  }
  return action;
}

export function parseManagerActionPayload(
  actionType: string,
  payload: unknown
) {
  return managerExecutableActionSchema.parse({
    ...((payload && typeof payload === 'object' ? payload : {}) as object),
    actionType,
  });
}
