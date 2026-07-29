import type { ManagerRiskLevel } from '@prisma/client';

import type { ManagerActionType } from './policy';

export type ActiveManagerPolicy = {
  ruleType: string;
  rulePayload: unknown;
  sourceActionId?: string | null;
};

export type ManagerPolicyOverride =
  | { decision: 'MUTE'; reason: string }
  | { decision: 'AUTO_EXECUTE'; reason: string }
  | null;

const PERMANENT_AUTO_APPROVAL_ACTIONS = new Set<ManagerActionType>([
  'CREATE_TASK',
  'CREATE_COMMITMENT',
  'CREATE_CRM_ACTIVITY',
  'UPDATE_LEAD_STAGE',
  'NOTIFY_OWNER',
  'ASK_CLARIFICATION',
]);

function payloadRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function canCreatePermanentAutoApproval(input: {
  actionType: ManagerActionType;
  riskLevel: ManagerRiskLevel;
}) {
  return (
    input.riskLevel === 'LOW' &&
    PERMANENT_AUTO_APPROVAL_ACTIONS.has(input.actionType)
  );
}

export function resolveManagerPolicyOverride(input: {
  actionType: ManagerActionType;
  riskLevel: ManagerRiskLevel;
  operationEventId?: string | null;
  policies: ActiveManagerPolicy[];
}): ManagerPolicyOverride {
  if (input.operationEventId) {
    const muted = input.policies.some((policy) => {
      const payload = payloadRecord(policy.rulePayload);
      return (
        policy.ruleType === 'MUTE_OPERATION_EVENT' &&
        payload.operationEventId === input.operationEventId
      );
    });
    if (muted && input.actionType === 'NOTIFY_OWNER') {
      return {
        decision: 'MUTE',
        reason: 'Patron bu olay için bildirimi sessize aldı.',
      };
    }
  }

  if (
    !canCreatePermanentAutoApproval({
      actionType: input.actionType,
      riskLevel: input.riskLevel,
    })
  ) {
    return null;
  }
  const automatic = input.policies.some((policy) => {
    const payload = payloadRecord(policy.rulePayload);
    return (
      policy.ruleType === 'AUTO_APPROVE_ACTION_TYPE' &&
      payload.actionType === input.actionType
    );
  });
  return automatic
    ? {
        decision: 'AUTO_EXECUTE',
        reason: 'Patronun kalıcı düşük risk kuralı uygulandı.',
      }
    : null;
}
