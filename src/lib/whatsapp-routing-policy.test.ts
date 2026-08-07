import { describe, expect, it } from 'vitest';

import {
  quotedOutboxIdentityContext,
  shouldRunCustomerAutoReply,
} from './whatsapp-routing-policy';

describe('WhatsApp flow routing policy', () => {
  const incomingPhone = '+90 555 111 22 33';

  it.each([
    ['EMPLOYEE', 'EMPLOYEE', 'INTERNAL_TASK'],
    ['OWNER', 'OWNER', 'GENERAL'],
    ['CRM_CONTACT', 'CRM_CONTACT', 'CUSTOMER_SERVICE'],
    ['PROPERTY_OWNER', 'PROPERTY_OWNER', 'AUTHORIZATION'],
  ] as const)(
    'keeps %s messages in their own recipient and purpose channel',
    (recipientType, preferredRole, messagePurpose) => {
      expect(
        quotedOutboxIdentityContext(
          {
            recipientType,
            recipientId: `${recipientType.toLowerCase()}-1`,
            toPhone: '905551112233',
          },
          incomingPhone
        )
      ).toEqual({
        preferredRole,
        preferredEntityId: `${recipientType.toLowerCase()}-1`,
        messagePurpose,
      });
    }
  );

  it('does not trust quoted recipient metadata when the sender phone differs', () => {
    expect(
      quotedOutboxIdentityContext(
        {
          recipientType: 'EMPLOYEE',
          recipientId: 'member-a',
          toPhone: '905551112244',
        },
        incomingPhone
      )
    ).toEqual({
      preferredRole: null,
      preferredEntityId: null,
      messagePurpose: 'GENERAL',
    });
  });

  it('stops automated customer replies after human handoff or global pause', () => {
    expect(
      shouldRunCustomerAutoReply({
        conversationAiEnabled: false,
        configAutoReplyEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldRunCustomerAutoReply({
        conversationAiEnabled: true,
        configAutoReplyEnabled: false,
      })
    ).toBe(false);
    expect(
      shouldRunCustomerAutoReply({
        conversationAiEnabled: true,
        configAutoReplyEnabled: null,
      })
    ).toBe(true);
  });
});
