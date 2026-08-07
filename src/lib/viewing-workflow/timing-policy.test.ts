import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DEFAULT_VIEWING_WORKFLOW_TIMINGS,
  loadViewingWorkflowTimings,
  resolveViewingWorkflowTimings,
} from './timing-policy';

describe('tenant viewing workflow timing policy', () => {
  it('reads validated version-2 onboarding operation timings', () => {
    expect(
      resolveViewingWorkflowTimings(
        {
          version: 2,
          operations: {
            employeeAcknowledgementMinutes: 35,
            ownerEscalationMinutes: 45,
            appointmentReminderHours: 36,
            appointmentOutcomeDelayMinutes: 90,
          },
        },
        'Akar Group'
      )
    ).toEqual({
      employeeReminderMinutes: 5,
      employeeAcknowledgementMinutes: 35,
      ownerEscalationMinutes: 45,
      appointmentReminderHours: 36,
      appointmentOutcomeDelayMinutes: 90,
    });
  });

  it('keeps legacy and malformed records on safe existing defaults', () => {
    expect(resolveViewingWorkflowTimings(null, 'Akar Group')).toEqual(
      DEFAULT_VIEWING_WORKFLOW_TIMINGS
    );
    expect(
      resolveViewingWorkflowTimings(
        {
          operations: {
            employeeAcknowledgementMinutes: 0,
            ownerEscalationMinutes: 'never',
            appointmentReminderHours: 10_000,
            appointmentOutcomeDelayMinutes: -1,
          },
        },
        'Akar Group'
      )
    ).toEqual(DEFAULT_VIEWING_WORKFLOW_TIMINGS);
  });

  it('loads only the current tenant profile and falls back when it is missing', async () => {
    const db = {
      companyAccount: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            companyName: 'Akar Group',
            onboardingState: {
              operations: { ownerEscalationMinutes: 60 },
            },
          })
          .mockResolvedValueOnce(null),
      },
      companySettings: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            employeeReminderMinutes: 7,
            employeeAcknowledgementMinutes: 35,
            ownerEscalationMinutes: 60,
            appointmentReminderHours: 36,
            appointmentOutcomeDelayMinutes: 45,
          })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(
      loadViewingWorkflowTimings('company-a', db as never)
    ).resolves.toEqual({
      employeeReminderMinutes: 7,
      employeeAcknowledgementMinutes: 35,
      ownerEscalationMinutes: 60,
      appointmentReminderHours: 36,
      appointmentOutcomeDelayMinutes: 45,
    });
    await expect(
      loadViewingWorkflowTimings('missing-company', db as never)
    ).resolves.toEqual(DEFAULT_VIEWING_WORKFLOW_TIMINGS);
    expect(db.companyAccount.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 'company-a' },
      select: { companyName: true, onboardingState: true },
    });
    expect(db.companySettings.findUnique).toHaveBeenNthCalledWith(1, {
      where: { companyAccountId: 'company-a' },
      select: {
        employeeReminderMinutes: true,
        employeeAcknowledgementMinutes: true,
        ownerEscalationMinutes: true,
        appointmentReminderHours: true,
        appointmentOutcomeDelayMinutes: true,
      },
    });
  });
});
