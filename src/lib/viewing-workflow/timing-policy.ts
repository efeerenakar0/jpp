import 'server-only';

import type { Prisma } from '@prisma/client';

import { normalizeCompanyOnboardingState } from '@/lib/company-onboarding';
import prisma from '@/lib/prisma';

export type ViewingWorkflowTimings = {
  employeeAcknowledgementMinutes: number;
  ownerEscalationMinutes: number;
  appointmentReminderHours: number;
  appointmentOutcomeDelayMinutes: number;
};

export const DEFAULT_VIEWING_WORKFLOW_TIMINGS: Readonly<ViewingWorkflowTimings> = Object.freeze({
  employeeAcknowledgementMinutes: 15,
  ownerEscalationMinutes: 15,
  appointmentReminderHours: 24,
  appointmentOutcomeDelayMinutes: 30,
});

type CompanyDb = Prisma.TransactionClient | typeof prisma;

export function resolveViewingWorkflowTimings(
  onboardingState: unknown,
  companyName = 'Şirketim'
): ViewingWorkflowTimings {
  const profile = normalizeCompanyOnboardingState(
    onboardingState,
    companyName.trim() || 'Şirketim'
  );

  return {
    employeeAcknowledgementMinutes:
      profile.operations.employeeAcknowledgementMinutes,
    ownerEscalationMinutes: profile.operations.ownerEscalationMinutes,
    appointmentReminderHours: profile.operations.appointmentReminderHours,
    appointmentOutcomeDelayMinutes:
      profile.operations.appointmentOutcomeDelayMinutes,
  };
}

export async function loadViewingWorkflowTimings(
  companyAccountId: string,
  db: CompanyDb = prisma
): Promise<ViewingWorkflowTimings> {
  const company = await db.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { companyName: true, onboardingState: true },
  });
  if (!company) return { ...DEFAULT_VIEWING_WORKFLOW_TIMINGS };

  return resolveViewingWorkflowTimings(
    company.onboardingState,
    company.companyName
  );
}
