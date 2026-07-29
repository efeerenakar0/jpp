import { describe, expect, it } from 'vitest';

import {
  canCreatePermanentAutoApproval,
  resolveManagerPolicyOverride,
} from './manager-policy';

describe('manager policy overrides', () => {
  it('allows only low-risk internal action types to become permanent rules', () => {
    expect(
      canCreatePermanentAutoApproval({
        actionType: 'CREATE_CRM_ACTIVITY',
        riskLevel: 'LOW',
      })
    ).toBe(true);
    expect(
      canCreatePermanentAutoApproval({
        actionType: 'SEND_EMPLOYEE_WHATSAPP',
        riskLevel: 'LOW',
      })
    ).toBe(false);
    expect(
      canCreatePermanentAutoApproval({
        actionType: 'CREATE_TASK',
        riskLevel: 'HIGH',
      })
    ).toBe(false);
  });

  it('mutes only owner notifications for the exact operation event', () => {
    const policies = [
      {
        ruleType: 'MUTE_OPERATION_EVENT',
        rulePayload: { operationEventId: 'event-1' },
      },
    ];
    expect(
      resolveManagerPolicyOverride({
        actionType: 'NOTIFY_OWNER',
        riskLevel: 'LOW',
        operationEventId: 'event-1',
        policies,
      })?.decision
    ).toBe('MUTE');
    expect(
      resolveManagerPolicyOverride({
        actionType: 'NOTIFY_OWNER',
        riskLevel: 'LOW',
        operationEventId: 'event-2',
        policies,
      })
    ).toBeNull();
  });

  it('never auto-executes unsafe action types through a permanent rule', () => {
    const policies = [
      {
        ruleType: 'AUTO_APPROVE_ACTION_TYPE',
        rulePayload: { actionType: 'OFFER_CONVERSATION_HANDOFF' },
      },
    ];
    expect(
      resolveManagerPolicyOverride({
        actionType: 'OFFER_CONVERSATION_HANDOFF',
        riskLevel: 'LOW',
        policies,
      })
    ).toBeNull();
  });
});
