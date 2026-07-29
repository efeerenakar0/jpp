import type { OperationalTaskStatus } from '@prisma/client';

import { canTransitionTask } from './workflow';

type CorrectionTaskSnapshot = {
  id: string;
  companyAccountId: string;
  assignedMemberId: string | null;
  workflowStatus: OperationalTaskStatus;
  workflowVersion?: number;
};

type CorrectionActionSnapshot = {
  actionType: string;
  requestedByType: string | null;
  requestedById: string | null;
  requiresApproval: boolean;
  status: string;
};

type CorrectionTransitionSnapshot = {
  id: string;
  companyAccountId: string;
  taskId: string;
  fromStatus: OperationalTaskStatus;
  toStatus: OperationalTaskStatus;
  task: CorrectionTaskSnapshot;
  managerAction: CorrectionActionSnapshot | null;
};

export type CorrectionSafetyInput = {
  companyAccountId: string;
  employeeId: string;
  correctedStatus: OperationalTaskStatus;
  evidenceText: string;
  correctTask: CorrectionTaskSnapshot | null;
  previousTransition: CorrectionTransitionSnapshot | null;
  latestWrongTaskTransitionId: string | null;
};

export type CorrectionSafetyFailureCode =
  | 'CORRECT_TASK_NOT_OWNED'
  | 'NO_PREVIOUS_TRANSITION'
  | 'PREVIOUS_TRANSITION_NOT_OWNED'
  | 'PREVIOUS_TRANSITION_NOT_AUTOMATIC'
  | 'SAME_TASK'
  | 'WRONG_TASK_ADVANCED'
  | 'CORRECT_STATUS_NOT_ALLOWED';

export type CorrectionSafetyResult =
  | { safe: true }
  | {
      safe: false;
      code: CorrectionSafetyFailureCode;
      clarificationQuestion: string;
    };

function unsafeCorrection(
  code: CorrectionSafetyFailureCode,
  clarificationQuestion: string
): CorrectionSafetyResult {
  return { safe: false, code, clarificationQuestion };
}

export function assessEmployeeTaskCorrection(
  input: CorrectionSafetyInput
): CorrectionSafetyResult {
  if (
    !input.correctTask ||
    input.correctTask.companyAccountId !== input.companyAccountId ||
    input.correctTask.assignedMemberId !== input.employeeId
  ) {
    return unsafeCorrection(
      'CORRECT_TASK_NOT_OWNED',
      'Düzeltmek istediğin doğru görevi açıkça belirtir misin?'
    );
  }
  const previous = input.previousTransition;
  if (!previous) {
    return unsafeCorrection(
      'NO_PREVIOUS_TRANSITION',
      'Geri alınabilecek son otomatik bildirimi bulamadım. Yanlış görev ile doğru görevi birlikte yazar mısın?'
    );
  }
  if (
    previous.companyAccountId !== input.companyAccountId ||
    previous.task.companyAccountId !== input.companyAccountId ||
    previous.task.assignedMemberId !== input.employeeId
  ) {
    return unsafeCorrection(
      'PREVIOUS_TRANSITION_NOT_OWNED',
      'Önceki bildirim bu şirket ve çalışan kaydıyla güvenle eşleşmedi. Yanlış görevi açıkça belirtir misin?'
    );
  }
  if (previous.taskId === input.correctTask.id) {
    return unsafeCorrection(
      'SAME_TASK',
      'Aynı görev için hangi eski durumun yanlış, hangi yeni durumun doğru olduğunu yazar mısın?'
    );
  }
  const previousAction = previous.managerAction;
  if (
    !previousAction ||
    previousAction.actionType !== 'UPDATE_TASK_STATUS' ||
    previousAction.requestedByType !== 'EMPLOYEE' ||
    previousAction.requestedById !== input.employeeId ||
    previousAction.requiresApproval ||
    previousAction.status !== 'EXECUTED'
  ) {
    return unsafeCorrection(
      'PREVIOUS_TRANSITION_NOT_AUTOMATIC',
      'Son kayıt otomatik bir çalışan bildirimi değil. Hangi kaydın düzeltilmesi gerektiğini açıkça belirtir misin?'
    );
  }
  if (
    input.latestWrongTaskTransitionId !== previous.id ||
    previous.task.workflowStatus !== previous.toStatus
  ) {
    return unsafeCorrection(
      'WRONG_TASK_ADVANCED',
      'Yanlış görev bu bildirimin ardından değişmiş. Güncel durumu bozmamak için hangi kaydın nasıl düzeltilmesini istediğini netleştirir misin?'
    );
  }
  const correctedTransition = canTransitionTask(
    input.correctTask.workflowStatus,
    input.correctedStatus,
    input.evidenceText
  );
  if (!correctedTransition.allowed) {
    return unsafeCorrection(
      'CORRECT_STATUS_NOT_ALLOWED',
      correctedTransition.clarificationQuestion ||
        'Doğru görev için uygulanacak durumu biraz daha açıklar mısın?'
    );
  }
  return { safe: true };
}
