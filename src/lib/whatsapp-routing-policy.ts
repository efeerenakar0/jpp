import { normalizeE164, type PartyRole } from '@/lib/digital-manager/domain';

type QuotedRecipientType =
  | 'OWNER'
  | 'EMPLOYEE'
  | 'CRM_CONTACT'
  | 'PROPERTY_OWNER'
  | 'UNKNOWN';

type MessagePurpose =
  | 'AUTHORIZATION'
  | 'CUSTOMER_SERVICE'
  | 'INTERNAL_TASK'
  | 'GENERAL';

const recipientContext: Partial<
  Record<QuotedRecipientType, { role: PartyRole; purpose: MessagePurpose }>
> = {
  OWNER: { role: 'OWNER', purpose: 'GENERAL' },
  EMPLOYEE: { role: 'EMPLOYEE', purpose: 'INTERNAL_TASK' },
  CRM_CONTACT: { role: 'CRM_CONTACT', purpose: 'CUSTOMER_SERVICE' },
  PROPERTY_OWNER: { role: 'PROPERTY_OWNER', purpose: 'AUTHORIZATION' },
};

export function quotedOutboxIdentityContext(
  quotedOutbox: {
    recipientType: QuotedRecipientType;
    recipientId: string | null;
    toPhone: string;
  } | null,
  incomingPhone: string
) {
  const matched =
    quotedOutbox &&
    quotedOutbox.recipientId &&
    normalizeE164(quotedOutbox.toPhone) === normalizeE164(incomingPhone)
      ? recipientContext[quotedOutbox.recipientType]
      : null;

  return matched
    ? {
        preferredRole: matched.role,
        preferredEntityId: quotedOutbox!.recipientId,
        messagePurpose: matched.purpose,
      }
    : {
        preferredRole: null,
        preferredEntityId: null,
        messagePurpose: 'GENERAL' as const,
      };
}

export function shouldRunCustomerAutoReply(input: {
  conversationAiEnabled: boolean;
  configAutoReplyEnabled: boolean | null | undefined;
}) {
  return (
    input.conversationAiEnabled && input.configAutoReplyEnabled !== false
  );
}
