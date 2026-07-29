import { describe, expect, it } from 'vitest';

import {
  managerExecutableActionSchema,
  validateManagerActionCandidates,
} from './action-schema';

const candidates = {
  accountId: 'company-1',
  memberIds: ['member-1'],
  taskIds: ['task-1'],
  contactIds: ['contact-1'],
  propertyIds: ['property-1'],
  dealIds: ['deal-1'],
  conversationIds: ['conversation-1'],
};

describe('digital manager executable action safety', () => {
  it('accepts only the documented action payload shape', () => {
    expect(
      managerExecutableActionSchema.parse({
        actionType: 'ASSIGN_EMPLOYEE',
        taskId: 'task-1',
        employeeId: 'member-1',
        reason: 'Mahmutlar bölgesinde uzman.',
      })
    ).toEqual(
      expect.objectContaining({
        actionType: 'ASSIGN_EMPLOYEE',
        taskId: 'task-1',
      })
    );
  });

  it('rejects an employee id that was not offered by the server', () => {
    const action = managerExecutableActionSchema.parse({
      actionType: 'ASSIGN_EMPLOYEE',
      taskId: 'task-1',
      employeeId: 'invented-member',
      reason: 'Atama',
    });
    expect(() =>
      validateManagerActionCandidates(action, candidates)
    ).toThrow(/doğrulanmış aday/i);
  });

  it('rejects an owner clarification sent to another tenant id', () => {
    const action = managerExecutableActionSchema.parse({
      actionType: 'ASK_CLARIFICATION',
      recipientType: 'OWNER',
      recipientId: 'company-2',
      question: 'Onaylıyor musunuz?',
    });
    expect(() =>
      validateManagerActionCandidates(action, candidates)
    ).toThrow(/şirket hesabıyla eşleşmiyor/i);
  });

  it('validates a natural-language temporary company policy', () => {
    expect(
      managerExecutableActionSchema.parse({
        actionType: 'CREATE_POLICY',
        scope: 'TEMPORARY',
        instruction:
          'Bir hafta boyunca yalnız kritik teslimat hatalarını hemen bildir.',
        expiresAt: '2026-08-05T09:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        actionType: 'CREATE_POLICY',
        scope: 'TEMPORARY',
      })
    );
  });
});
