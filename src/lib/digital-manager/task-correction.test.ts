import { describe, expect, it } from 'vitest';

import {
  assessEmployeeTaskCorrection,
  type CorrectionSafetyInput,
} from './task-correction-policy';

const baseInput: CorrectionSafetyInput = {
  companyAccountId: 'company-1',
  employeeId: 'employee-1',
  correctedStatus: 'ACCEPTED',
  evidenceText: "Önceki mesajım yanlış; Ayşe Hanım'ın işini aldım.",
  correctTask: {
    id: 'task-correct',
    companyAccountId: 'company-1',
    assignedMemberId: 'employee-1',
    workflowStatus: 'DELIVERED',
  },
  previousTransition: {
    id: 'transition-wrong',
    companyAccountId: 'company-1',
    taskId: 'task-wrong',
    fromStatus: 'DELIVERED',
    toStatus: 'ACCEPTED',
    task: {
      id: 'task-wrong',
      companyAccountId: 'company-1',
      assignedMemberId: 'employee-1',
      workflowStatus: 'ACCEPTED',
    },
    managerAction: {
      actionType: 'UPDATE_TASK_STATUS',
      requestedByType: 'EMPLOYEE',
      requestedById: 'employee-1',
      requiresApproval: false,
      status: 'EXECUTED',
    },
  },
  latestWrongTaskTransitionId: 'transition-wrong',
};

describe('verified employee task correction safety', () => {
  it('allows a uniquely matched correction while the mistaken transition is still current', () => {
    expect(assessEmployeeTaskCorrection(baseInput)).toEqual({
      safe: true,
    });
  });

  it('refuses to undo a transition after the wrong task advanced again', () => {
    expect(
      assessEmployeeTaskCorrection({
        ...baseInput,
        latestWrongTaskTransitionId: 'transition-newer',
      })
    ).toEqual(
      expect.objectContaining({
        safe: false,
        code: 'WRONG_TASK_ADVANCED',
      })
    );
  });

  it('refuses a transition created by another tenant or employee', () => {
    expect(
      assessEmployeeTaskCorrection({
        ...baseInput,
        previousTransition: {
          ...baseInput.previousTransition!,
          companyAccountId: 'company-2',
        },
      })
    ).toEqual(
      expect.objectContaining({
        safe: false,
        code: 'PREVIOUS_TRANSITION_NOT_OWNED',
      })
    );
  });

  it('refuses to reverse a manual or approval-gated action', () => {
    expect(
      assessEmployeeTaskCorrection({
        ...baseInput,
        previousTransition: {
          ...baseInput.previousTransition!,
          managerAction: {
            ...baseInput.previousTransition!.managerAction!,
            requiresApproval: true,
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        safe: false,
        code: 'PREVIOUS_TRANSITION_NOT_AUTOMATIC',
      })
    );
  });

  it('refuses a corrected status that skips required workflow steps', () => {
    expect(
      assessEmployeeTaskCorrection({
        ...baseInput,
        correctedStatus: 'COMPLETED',
        correctTask: {
          ...baseInput.correctTask!,
          workflowStatus: 'DELIVERED',
        },
      })
    ).toEqual(
      expect.objectContaining({
        safe: false,
        code: 'CORRECT_STATUS_NOT_ALLOWED',
      })
    );
  });

  it('asks for clarification when no prior automatic transition exists', () => {
    expect(
      assessEmployeeTaskCorrection({
        ...baseInput,
        previousTransition: null,
        latestWrongTaskTransitionId: null,
      })
    ).toEqual(
      expect.objectContaining({
        safe: false,
        code: 'NO_PREVIOUS_TRANSITION',
      })
    );
  });
});
