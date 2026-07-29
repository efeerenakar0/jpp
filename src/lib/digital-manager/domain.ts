import { z } from 'zod';

export const partyRoleSchema = z.enum([
  'OWNER',
  'EMPLOYEE',
  'CRM_CONTACT',
  'PROPERTY_OWNER',
  'UNKNOWN',
]);

export type PartyRole = z.infer<typeof partyRoleSchema>;

export type IdentityCandidate = {
  role: PartyRole;
  entityId: string;
  phone: string;
};

export type IdentityResolution =
  | {
      status: 'RESOLVED';
      role: PartyRole;
      entityId: string;
      clarificationQuestion: null;
    }
  | {
      status: 'AMBIGUOUS' | 'UNKNOWN';
      role: null;
      entityId: null;
      clarificationQuestion: string;
    };

export type TaskWorkflowState =
  | 'CREATED'
  | 'ASSIGNED'
  | 'MESSAGE_QUEUED'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'APPOINTMENT_PROPOSED'
  | 'APPOINTMENT_CONFIRMED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'REASSIGNMENT_REQUIRED'
  | 'CANCELLED'
  | 'FAILED';

export type TaskCandidate = {
  id: string;
  title: string;
  workflowState: TaskWorkflowState;
  assignedEmployeeId: string | null;
  contactName?: string | null;
  propertyTitle?: string | null;
  outboundProviderMessageId?: string | null;
  conversationId?: string | null;
  updatedAt: string;
};

const commitmentSchema = z.object({
  description: z.string().min(1).max(500),
  dueAt: z.string().datetime().nullable(),
  relativeTimeText: z.string().min(1).max(100).nullable(),
});

export const employeeInterpreterResultSchema = z.object({
  intent: z.enum([
    'TASK_ACCEPTED',
    'TASK_IN_PROGRESS',
    'CUSTOMER_UNREACHABLE',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'TASK_REJECTED',
    'REASSIGNMENT_REQUESTED',
    'TASK_CORRECTION',
    'TASK_COMPLETED',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
  taskId: z.string().min(1).nullable(),
  employeeId: z.string().min(1),
  statusProposal: z
    .enum([
      'ACCEPTED',
      'IN_PROGRESS',
      'WAITING_CUSTOMER',
      'APPOINTMENT_PROPOSED',
      'APPOINTMENT_CONFIRMED',
      'REJECTED',
      'REASSIGNMENT_REQUIRED',
      'COMPLETED',
    ])
    .nullable(),
  nextAction: z.string().max(500).nullable(),
  commitment: commitmentSchema.nullable(),
  evidence: z
    .array(
      z.object({
        type: z.enum([
          'WHATSAPP_MESSAGE',
          'CRM_ACTIVITY',
          'OPERATION_EVENT',
          'TASK',
        ]),
        id: z.string().min(1),
      })
    )
    .max(20),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().max(500).nullable(),
});

export type EmployeeInterpreterResult = z.infer<
  typeof employeeInterpreterResultSchema
>;

function digits(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function normalizeE164(
  value: string | null | undefined,
  defaultCountry: 'TR' | string = 'TR'
) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalizedDigits = digits(trimmed);
  if (!normalizedDigits) return null;

  let international = normalizedDigits;
  if (trimmed.startsWith('+')) {
    international = normalizedDigits;
  } else if (normalizedDigits.startsWith('00')) {
    international = normalizedDigits.slice(2);
  } else if (defaultCountry === 'TR') {
    if (normalizedDigits.startsWith('0') && normalizedDigits.length === 11) {
      international = `90${normalizedDigits.slice(1)}`;
    } else if (
      normalizedDigits.length === 10 &&
      normalizedDigits.startsWith('5')
    ) {
      international = `90${normalizedDigits}`;
    }
  }

  if (international.length < 10 || international.length > 15) return null;
  return `+${international}`;
}

export function validateEmployeePhoneAssignment(input: {
  phone: string;
  connectedCompanyPhone?: string | null;
  activeEmployeePhones: Array<string | null | undefined>;
  currentEmployeePhone?: string | null;
}) {
  const normalizedPhone = normalizeE164(input.phone);
  if (!normalizedPhone) {
    throw new Error('Geçerli, ülke kodlu bir telefon numarası girin.');
  }
  const connectedPhone = normalizeE164(input.connectedCompanyPhone);
  if (connectedPhone && connectedPhone === normalizedPhone) {
    throw new Error(
      'Şirketin bağlı WhatsApp numarası ekip üyesi numarası olarak kullanılamaz.'
    );
  }
  const currentPhone = normalizeE164(input.currentEmployeePhone);
  const hasConflict = input.activeEmployeePhones
    .map((phone) => normalizeE164(phone))
    .some(
      (phone) =>
        phone === normalizedPhone &&
        (!currentPhone || normalizedPhone !== currentPhone)
    );
  if (hasConflict) {
    throw new Error(
      'Bu telefon numarası başka bir aktif ekip üyesine atanmış.'
    );
  }
  return normalizedPhone;
}

export function chooseIdentityRole(
  candidates: IdentityCandidate[],
  context: {
    activeConversationRole?: PartyRole | null;
    messagePurpose?:
      | 'AUTHORIZATION'
      | 'CUSTOMER_SERVICE'
      | 'INTERNAL_TASK'
      | 'GENERAL'
      | null;
  }
): IdentityResolution {
  if (candidates.length === 0) {
    return {
      status: 'UNKNOWN',
      role: null,
      entityId: null,
      clarificationQuestion:
        'Sizi doğru kayıtla eşleştiremedim. Hangi konuda yazdığınızı kısaca belirtir misiniz?',
    };
  }
  if (candidates.length === 1) {
    return {
      status: 'RESOLVED',
      role: candidates[0].role,
      entityId: candidates[0].entityId,
      clarificationQuestion: null,
    };
  }

  const roleFromConversation = context.activeConversationRole
    ? candidates.find(
        (candidate) => candidate.role === context.activeConversationRole
      )
    : null;
  if (roleFromConversation) {
    return {
      status: 'RESOLVED',
      role: roleFromConversation.role,
      entityId: roleFromConversation.entityId,
      clarificationQuestion: null,
    };
  }

  const roleByPurpose: Partial<
    Record<NonNullable<typeof context.messagePurpose>, PartyRole>
  > = {
    AUTHORIZATION: 'PROPERTY_OWNER',
    CUSTOMER_SERVICE: 'CRM_CONTACT',
    INTERNAL_TASK: 'EMPLOYEE',
  };
  const purposeRole = context.messagePurpose
    ? roleByPurpose[context.messagePurpose]
    : null;
  const purposeCandidate = purposeRole
    ? candidates.find((candidate) => candidate.role === purposeRole)
    : null;
  if (purposeCandidate) {
    return {
      status: 'RESOLVED',
      role: purposeCandidate.role,
      entityId: purposeCandidate.entityId,
      clarificationQuestion: null,
    };
  }

  return {
    status: 'AMBIGUOUS',
    role: null,
    entityId: null,
    clarificationQuestion:
      'Bu numara birden fazla kayda bağlı görünüyor. Hangi konu için yazıyorsunuz: müşteri talebi mi, portföy/yetki süreci mi?',
  };
}

function istanbulParts(date: Date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function istanbulDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
) {
  // Türkiye 2016'dan beri yıl boyunca UTC+3 kullanıyor.
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

export function resolveCommitmentDueAt(
  relativeText: string,
  messageTime: Date
) {
  const normalized = relativeText.toLocaleLowerCase('tr-TR');
  const parts = istanbulParts(messageTime);
  if (normalized.includes('birazdan')) {
    return new Date(messageTime.getTime() + 30 * 60 * 1000);
  }
  if (normalized.includes('akşama kadar') || normalized.includes('aksama kadar')) {
    return istanbulDateToUtc(
      parts.year,
      parts.month,
      parts.day,
      21
    );
  }

  const explicitHour =
    normalized.match(/(?:saat\s*)?(\d{1,2})(?::(\d{2}))?/) || null;
  if (normalized.includes('yarın') || normalized.includes('yarin')) {
    const tomorrow = new Date(
      istanbulDateToUtc(parts.year, parts.month, parts.day, 12).getTime() +
        24 * 60 * 60 * 1000
    );
    const tomorrowParts = istanbulParts(tomorrow);
    return istanbulDateToUtc(
      tomorrowParts.year,
      tomorrowParts.month,
      tomorrowParts.day,
      explicitHour ? Number(explicitHour[1]) : 10,
      explicitHour?.[2] ? Number(explicitHour[2]) : 0
    );
  }
  return null;
}

function commitmentFromMessage(message: string, messageTime: Date) {
  const normalized = message.toLocaleLowerCase('tr-TR');
  const commitmentMatch = normalized.match(
    /(birazdan|akşama kadar|aksama kadar|yarın(?:\s+saat)?\s+\d{1,2}(?::\d{2})?)/i
  );
  if (!commitmentMatch || !/(arayacağım|arayacagim|döneceğim|donecegim|göstereceğim|gosterecegim|yapacağım|yapacagim)/i.test(normalized)) {
    return null;
  }
  const relativeTimeText = commitmentMatch[1];
  return {
    description: /ara/i.test(normalized)
      ? 'İlgili kişiyi aramak'
      : 'Belirtilen takip işlemini tamamlamak',
    dueAt: resolveCommitmentDueAt(
      relativeTimeText,
      messageTime
    )?.toISOString() ?? null,
    relativeTimeText,
  };
}

type ConcreteEmployeeUpdate = Pick<
  EmployeeInterpreterResult,
  | 'intent'
  | 'statusProposal'
  | 'confidence'
  | 'requiresClarification'
  | 'clarificationQuestion'
>;

function deriveConcreteEmployeeUpdate(
  normalized: string
): ConcreteEmployeeUpdate | null {
  if (
    /(olabilir|kesin dönüş|kesin donus)/i.test(normalized) &&
    /(yarın|yarin|saat|randevu)/i.test(normalized)
  ) {
    return {
      intent: 'APPOINTMENT_PROPOSED',
      statusProposal: 'APPOINTMENT_PROPOSED',
      confidence: 0.88,
      requiresClarification: true,
      clarificationQuestion:
        'Saat henüz kesinleşmedi olarak kaydettim. Kesinleşince haber verir misin?',
    };
  }
  if (
    /(anlaştık|anlastik|randevu kesin|gösterim kesin)/i.test(normalized) &&
    /(yarın|yarin|saat|\d{1,2}(?::\d{2})?)/i.test(normalized)
  ) {
    return {
      intent: 'APPOINTMENT_CONFIRMED',
      statusProposal: 'APPOINTMENT_CONFIRMED',
      confidence: 0.94,
      requiresClarification: false,
      clarificationQuestion: null,
    };
  }
  if (/(açmadı|acmadi|ulaşamadım|ulasamadim)/i.test(normalized)) {
    return {
      intent: 'CUSTOMER_UNREACHABLE',
      statusProposal: 'WAITING_CUSTOMER',
      confidence: 0.95,
      requiresClarification: false,
      clarificationQuestion: null,
    };
  }
  if (/(arıyorum|ariyorum|görüşüyorum|gorusuyorum)/i.test(normalized)) {
    return {
      intent: 'TASK_IN_PROGRESS',
      statusProposal: 'IN_PROGRESS',
      confidence: 0.92,
      requiresClarification: false,
      clarificationQuestion: null,
    };
  }
  if (
    /(tamam|görev bende|gorev bende|ben ilgileniyorum|üstleniyorum|ustleniyorum|(?:işi|isi|işini|isini)\s+(?:aldım|aldim))/i.test(
      normalized
    )
  ) {
    return {
      intent: 'TASK_ACCEPTED',
      statusProposal: 'ACCEPTED',
      confidence: 0.96,
      requiresClarification: false,
      clarificationQuestion: null,
    };
  }
  if (/(alamam|ilgilenemem|reddediyorum)/i.test(normalized)) {
    return {
      intent: 'TASK_REJECTED',
      statusProposal: 'REJECTED',
      confidence: 0.94,
      requiresClarification: false,
      clarificationQuestion: null,
    };
  }
  return null;
}

export function deriveEmployeeIntent(
  message: string,
  messageTime = new Date(),
  employeeId = 'verified-employee'
): EmployeeInterpreterResult {
  const normalized = message.trim().toLocaleLowerCase('tr-TR');
  const unsafeInstruction =
    /(önceki|tum|tüm).{0,20}(kural|talimat).{0,20}(unut|yoksay)|beni\s+(patron|admin)\s+yap|bütün\s+kayıtları\s+sil/i.test(
      normalized
    );

  let intent: EmployeeInterpreterResult['intent'] = 'UNKNOWN';
  let statusProposal: EmployeeInterpreterResult['statusProposal'] = null;
  let confidence = 0.35;
  let requiresClarification = true;
  let clarificationQuestion: string | null =
    'Hangi görevle ilgili olduğunu ve somut sonucu biraz daha açıklar mısın?';

  if (!unsafeInstruction) {
    const concreteUpdate = deriveConcreteEmployeeUpdate(normalized);
    const isCorrection =
      /(yanlış|yanlis|düzeltme|duzeltme|öyle değil|oyle degil|geri al)/i.test(
        normalized
      );
    if (isCorrection) {
      intent = 'TASK_CORRECTION';
      statusProposal = concreteUpdate?.statusProposal ?? null;
      confidence = concreteUpdate
        ? Math.min(0.96, concreteUpdate.confidence)
        : 0.9;
      requiresClarification =
        !concreteUpdate || concreteUpdate.requiresClarification;
      clarificationQuestion = concreteUpdate
        ? concreteUpdate.clarificationQuestion
        : 'Önceki kaydın hangi bölümünün yanlış olduğunu ve doğru durumu yazar mısın?';
    } else if (concreteUpdate) {
      ({
        intent,
        statusProposal,
        confidence,
        requiresClarification,
        clarificationQuestion,
      } = concreteUpdate);
    }
  }

  return {
    intent,
    confidence,
    taskId: null,
    employeeId,
    statusProposal,
    nextAction: null,
    commitment: commitmentFromMessage(message, messageTime),
    evidence: [],
    requiresClarification,
    clarificationQuestion,
  };
}

function normalizedSearchText(value: string | null | undefined) {
  return (value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchTaskCandidate(input: {
  candidates: TaskCandidate[];
  message: string;
  quotedProviderMessageId?: string | null;
  conversationId?: string | null;
}) {
  if (input.quotedProviderMessageId) {
    const replyMatch = input.candidates.find(
      (candidate) =>
        candidate.outboundProviderMessageId === input.quotedProviderMessageId
    );
    if (replyMatch) {
      return {
        status: 'MATCHED' as const,
        taskId: replyMatch.id,
        confidence: 1,
        clarificationQuestion: null,
      };
    }
  }
  if (input.conversationId) {
    const conversationMatches = input.candidates.filter(
      (candidate) => candidate.conversationId === input.conversationId
    );
    if (conversationMatches.length === 1) {
      return {
        status: 'MATCHED' as const,
        taskId: conversationMatches[0].id,
        confidence: 0.95,
        clarificationQuestion: null,
      };
    }
  }
  if (input.candidates.length === 1) {
    return {
      status: 'MATCHED' as const,
      taskId: input.candidates[0].id,
      confidence: 0.9,
      clarificationQuestion: null,
    };
  }

  const words = new Set(
    normalizedSearchText(input.message)
      .split(' ')
      .filter((word) => word.length >= 3)
  );
  const scored = input.candidates
    .map((candidate) => {
      const haystack = normalizedSearchText(
        [
          candidate.title,
          candidate.contactName,
          candidate.propertyTitle,
        ].join(' ')
      );
      const score = [...words].filter((word) => haystack.includes(word)).length;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  if (
    scored[0]?.score &&
    scored[0].score > (scored[1]?.score ?? 0)
  ) {
    return {
      status: 'MATCHED' as const,
      taskId: scored[0].candidate.id,
      confidence: Math.min(0.89, 0.65 + scored[0].score * 0.08),
      clarificationQuestion: null,
    };
  }

  const labels = input.candidates
    .slice(0, 3)
    .map((candidate) => candidate.title)
    .join(' veya ');
  return {
    status: 'AMBIGUOUS' as const,
    taskId: null,
    confidence: 0,
    clarificationQuestion: `Birden fazla açık işin görünüyor: ${labels}. Hangisini kastettiğini netleştirebilir misin?`,
  };
}

export function validateInterpreterResult(
  value: unknown,
  context: {
    candidateTaskIds: string[];
    verifiedEmployeeId: string;
  }
) {
  const parsed = employeeInterpreterResultSchema.parse(value);
  if (parsed.employeeId !== context.verifiedEmployeeId) {
    throw new Error('Yorumdaki çalışan doğrulanmış çalışanla eşleşmiyor.');
  }
  if (
    parsed.taskId &&
    !context.candidateTaskIds.includes(parsed.taskId)
  ) {
    throw new Error('Yorum yalnızca sunulan aday görevlerden birini seçebilir.');
  }
  return parsed;
}
