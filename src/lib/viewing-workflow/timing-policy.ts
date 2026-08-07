import 'server-only';

import type { Prisma } from '@prisma/client';

import { normalizeCompanyOnboardingState } from '@/lib/company-onboarding';
import prisma from '@/lib/prisma';

export type ViewingWorkflowTimings = {
  employeeReminderMinutes: number;
  employeeAcknowledgementMinutes: number;
  ownerEscalationMinutes: number;
  appointmentReminderHours: number;
  appointmentOutcomeDelayMinutes: number;
};

export const DEFAULT_VIEWING_WORKFLOW_TIMINGS: Readonly<ViewingWorkflowTimings> = Object.freeze({
  employeeReminderMinutes: 5,
  employeeAcknowledgementMinutes: 15,
  ownerEscalationMinutes: 15,
  appointmentReminderHours: 24,
  appointmentOutcomeDelayMinutes: 30,
});

type CompanyDb = Prisma.TransactionClient | typeof prisma;

export function resolveViewingWorkflowTimings(
  onboardingState: unknown,
  companyName = 'Şirketim',
  settings?: Partial<ViewingWorkflowTimings> | null
): ViewingWorkflowTimings {
  const profile = normalizeCompanyOnboardingState(
    onboardingState,
    companyName.trim() || 'Şirketim'
  );

  const legacy = {
    employeeReminderMinutes:
      DEFAULT_VIEWING_WORKFLOW_TIMINGS.employeeReminderMinutes,
    employeeAcknowledgementMinutes:
      profile.operations.employeeAcknowledgementMinutes,
    ownerEscalationMinutes: profile.operations.ownerEscalationMinutes,
    appointmentReminderHours: profile.operations.appointmentReminderHours,
    appointmentOutcomeDelayMinutes:
      profile.operations.appointmentOutcomeDelayMinutes,
  };

  const integer = (
    value: number | undefined,
    minimum: number,
    maximum: number,
    fallback: number
  ) =>
    Number.isInteger(value) && value! >= minimum && value! <= maximum
      ? value!
      : fallback;
  const employeeAcknowledgementMinutes = integer(
    settings?.employeeAcknowledgementMinutes,
    5,
    120,
    legacy.employeeAcknowledgementMinutes
  );
  const candidateReminder = integer(
    settings?.employeeReminderMinutes,
    1,
    60,
    legacy.employeeReminderMinutes
  );

  return {
    employeeReminderMinutes:
      candidateReminder < employeeAcknowledgementMinutes
        ? candidateReminder
        : Math.max(1, employeeAcknowledgementMinutes - 1),
    employeeAcknowledgementMinutes,
    ownerEscalationMinutes: integer(
      settings?.ownerEscalationMinutes,
      5,
      240,
      legacy.ownerEscalationMinutes
    ),
    appointmentReminderHours: integer(
      settings?.appointmentReminderHours,
      1,
      72,
      legacy.appointmentReminderHours
    ),
    appointmentOutcomeDelayMinutes: integer(
      settings?.appointmentOutcomeDelayMinutes,
      5,
      1_440,
      legacy.appointmentOutcomeDelayMinutes
    ),
  };
}

export async function loadViewingWorkflowTimings(
  companyAccountId: string,
  db: CompanyDb = prisma
): Promise<ViewingWorkflowTimings> {
  const [company, settings] = await Promise.all([
    db.companyAccount.findUnique({
      where: { id: companyAccountId },
      select: { companyName: true, onboardingState: true },
    }),
    db.companySettings.findUnique({
      where: { companyAccountId },
      select: {
        employeeReminderMinutes: true,
        employeeAcknowledgementMinutes: true,
        ownerEscalationMinutes: true,
        appointmentReminderHours: true,
        appointmentOutcomeDelayMinutes: true,
      },
    }),
  ]);
  if (!company) return { ...DEFAULT_VIEWING_WORKFLOW_TIMINGS };

  return resolveViewingWorkflowTimings(
    company.onboardingState,
    company.companyName,
    settings
  );
}
