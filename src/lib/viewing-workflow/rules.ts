export const VIEWING_ACK_MINUTES = 15;

export type PromptExpectedResponseType =
  | 'ASSIGNMENT_ACK'
  | 'OWNER_REASSIGNMENT_DECISION'
  | 'APPOINTMENT_CONFIRMATION'
  | 'APPOINTMENT_OUTCOME'
  | 'SALE_DECISION';

export type CorrelatablePrompt = {
  id: string;
  shortCode: string;
  recipientId: string;
  expectedResponseType: PromptExpectedResponseType;
  sentProviderMessageId: string | null;
  status: 'OPEN' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
};

export function acknowledgementDeadline(sentAt: Date) {
  return new Date(sentAt.getTime() + VIEWING_ACK_MINUTES * 60_000);
}

export function shouldTimeoutAssignment(input: {
  status: string;
  ackDeadlineAt: Date | null;
  now: Date;
}) {
  return (
    input.status === 'AWAITING_ACK' &&
    Boolean(input.ackDeadlineAt) &&
    input.ackDeadlineAt!.getTime() <= input.now.getTime()
  );
}

function normalizeCode(value: string) {
  return value.toLocaleUpperCase('tr-TR').replace(/^#/, '');
}

export function extractShortCode(text: string) {
  const match = text.match(/#([A-ZÇĞİÖŞÜ0-9]{3,12})\b/iu);
  return match?.[1] ? normalizeCode(match[1]) : null;
}

export function correlateInteractionPrompt(input: {
  prompts: CorrelatablePrompt[];
  recipientId: string;
  expectedResponseType: PromptExpectedResponseType;
  text: string;
  quotedProviderMessageId?: string | null;
}) {
  const compatible = input.prompts.filter(
    (prompt) =>
      prompt.status === 'OPEN' &&
      prompt.recipientId === input.recipientId &&
      prompt.expectedResponseType === input.expectedResponseType
  );
  if (input.quotedProviderMessageId) {
    const quoted = compatible.filter(
      (prompt) =>
        prompt.sentProviderMessageId === input.quotedProviderMessageId
    );
    if (quoted.length === 1) {
      return { prompt: quoted[0], reason: 'QUOTED' as const };
    }
  }

  const shortCode = extractShortCode(input.text);
  if (shortCode) {
    const coded = compatible.filter(
      (prompt) => normalizeCode(prompt.shortCode) === shortCode
    );
    if (coded.length === 1) {
      return { prompt: coded[0], reason: 'SHORT_CODE' as const };
    }
  }
  if (compatible.length === 1) {
    return { prompt: compatible[0], reason: 'SOLE_COMPATIBLE' as const };
  }
  return {
    prompt: null,
    reason: compatible.length === 0 ? ('NOT_FOUND' as const) : ('AMBIGUOUS' as const),
  };
}

export type InteractionReply = {
  shortCode: string | null;
  action:
    | 'ACCEPT'
    | 'REJECT'
    | 'REASSIGN'
    | 'WAIT'
    | 'CANCEL'
    | 'REMEMBER'
    | 'CANNOT_ATTEND'
    | 'SOLD_REPORTED'
    | 'NOT_SOLD'
    | 'FOLLOW_UP'
    | 'CUSTOMER_NO_SHOW'
    | 'EMPLOYEE_NO_SHOW'
    | 'REMOVE_SOLD_PROPERTY'
    | 'KEEP_PROPERTY'
    | 'DETAIL'
    | 'UNKNOWN';
  reason: string | null;
  candidateIndex: number | null;
};

export function parseInteractionReply(text: string): InteractionReply {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const upper = normalized.toLocaleUpperCase('tr-TR');
  const shortCode = extractShortCode(normalized);
  const reason = normalized.match(/:\s*(.+)$/u)?.[1]?.trim() || null;
  const reassign = upper.match(/(?:#\S+\s+)?(\d+)\s*['’]?(?:E|YE)\s+ATA/u);

  if (reassign?.[1]) {
    return {
      shortCode,
      action: 'REASSIGN',
      reason,
      candidateIndex: Number(reassign[1]),
    };
  }
  const actions: Array<[RegExp, InteractionReply['action']]> = [
    [/\bKABUL\b/u, 'ACCEPT'],
    [/\bRED\b/u, 'REJECT'],
    [/\bBEKLE\b/u, 'WAIT'],
    [/\bİPTAL\b/u, 'CANCEL'],
    [/\bHATIRLIYORUM\b/u, 'REMEMBER'],
    [/\bKATILAMIYORUM\b/u, 'CANNOT_ATTEND'],
    [/\bSATILMADI\b/u, 'NOT_SOLD'],
    [/\bSATILDI\b/u, 'SOLD_REPORTED'],
    [/\bTAKİPTE\b/u, 'FOLLOW_UP'],
    [/\bMÜŞTERİ GELMEDİ\b/u, 'CUSTOMER_NO_SHOW'],
    [/\b(?:BEN|ÇALIŞAN) GELMEDİ(?:M)?\b/u, 'EMPLOYEE_NO_SHOW'],
    [/\bKALDIR\b/u, 'REMOVE_SOLD_PROPERTY'],
    [/\bTUT\b/u, 'KEEP_PROPERTY'],
    [/\bDETAY\b/u, 'DETAIL'],
  ];
  const action = actions.find(([pattern]) => pattern.test(upper))?.[1] || 'UNKNOWN';
  return { shortCode, action, reason, candidateIndex: null };
}

export function expectedResponseTypesForAction(
  action: InteractionReply['action']
): PromptExpectedResponseType[] {
  switch (action) {
    case 'ACCEPT':
    case 'REJECT':
      return ['ASSIGNMENT_ACK'];
    case 'REASSIGN':
    case 'WAIT':
      return ['OWNER_REASSIGNMENT_DECISION'];
    case 'REMEMBER':
    case 'CANNOT_ATTEND':
      return ['APPOINTMENT_CONFIRMATION'];
    case 'SOLD_REPORTED':
    case 'NOT_SOLD':
    case 'FOLLOW_UP':
    case 'CUSTOMER_NO_SHOW':
    case 'EMPLOYEE_NO_SHOW':
      return ['APPOINTMENT_OUTCOME'];
    case 'REMOVE_SOLD_PROPERTY':
    case 'KEEP_PROPERTY':
    case 'DETAIL':
      return ['SALE_DECISION'];
    case 'CANCEL':
      return ['OWNER_REASSIGNMENT_DECISION', 'APPOINTMENT_OUTCOME'];
    default:
      return [];
  }
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function localDateTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}) {
  const desired = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute
  );
  let candidate = new Date(desired);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = zonedParts(candidate, input.timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate = new Date(candidate.getTime() + desired - represented);
  }
  const confirmed = zonedParts(candidate, input.timezone);
  if (
    confirmed.year !== input.year ||
    confirmed.month !== input.month ||
    confirmed.day !== input.day ||
    confirmed.hour !== input.hour ||
    confirmed.minute !== input.minute
  ) {
    return null;
  }
  return candidate;
}

export function parseAppointmentInstruction(text: string, timezone: string) {
  const match = text.match(
    /(?:#([A-ZÇĞİÖŞÜ0-9]{3,12})\s+)?RANDEVU\s+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\s+(\d{1,2}):(\d{2})/iu
  );
  if (!match) return null;
  const [, code, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    year < 2020 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  let start: Date | null;
  try {
    start = localDateTimeToUtc({
      year,
      month,
      day,
      hour,
      minute,
      timezone,
    });
  } catch {
    return null;
  }
  if (!start) return null;
  return {
    shortCode: code ? normalizeCode(code) : null,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    timezone,
  };
}

export function appointmentOutcomeForAction(
  action: InteractionReply['action']
):
  | 'SOLD_REPORTED'
  | 'NOT_SOLD'
  | 'FOLLOW_UP'
  | 'CUSTOMER_NO_SHOW'
  | 'EMPLOYEE_NO_SHOW'
  | 'CANCELLED'
  | null {
  switch (action) {
    case 'SOLD_REPORTED':
    case 'NOT_SOLD':
    case 'FOLLOW_UP':
    case 'CUSTOMER_NO_SHOW':
    case 'EMPLOYEE_NO_SHOW':
      return action;
    case 'CANCEL':
      return 'CANCELLED';
    default:
      return null;
  }
}

export function parseFollowUpDate(text: string, timezone: string) {
  const match = text.match(
    /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/u
  );
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw, hourRaw = '10', minuteRaw = '00'] = match;
  try {
    return localDateTimeToUtc({
      year: Number(yearRaw),
      month: Number(monthRaw),
      day: Number(dayRaw),
      hour: Number(hourRaw),
      minute: Number(minuteRaw),
      timezone,
    });
  } catch {
    return null;
  }
}

export function appointmentLifecycleDecision(input: {
  now: Date;
  startAt: Date;
  endAt: Date;
  employeeReminderSentAt: Date | null;
  outcomePromptSentAt: Date | null;
  hasOutcome: boolean;
}) {
  if (
    !input.hasOutcome &&
    !input.outcomePromptSentAt &&
    input.now.getTime() >= input.endAt.getTime() + 30 * 60_000
  ) {
    return 'SEND_OUTCOME' as const;
  }
  if (
    !input.employeeReminderSentAt &&
    input.now.getTime() >= input.startAt.getTime() - 24 * 60 * 60_000 &&
    input.now.getTime() < input.startAt.getTime()
  ) {
    return 'SEND_CONFIRMATION' as const;
  }
  return 'NONE' as const;
}
