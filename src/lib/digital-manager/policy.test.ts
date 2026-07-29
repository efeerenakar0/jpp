import { describe, expect, it } from 'vitest';

import {
  deliveryPresentation,
  evaluateActionPolicy,
  shouldNotifyOwnerNow,
  type ManagerPolicySettings,
} from './policy';

const baseSettings: ManagerPolicySettings = {
  autonomyMode: 'APPROVAL_REQUIRED',
  allowAutomaticEmployeeAssignment: false,
  allowAutomaticEmployeeWhatsApp: false,
  notifyCriticalImmediately: true,
  notifyTaskAccepted: false,
  notifyOnlyProblemsAndDelays: true,
  alwaysNotifyHotLeads: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'Europe/Istanbul',
};

describe('digital manager policy and delivery truthfulness', () => {
  it('allows a verified internal task acceptance without approval', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'UPDATE_TASK_STATUS',
          riskLevel: 'LOW',
          statusProposal: 'ACCEPTED',
        },
        baseSettings
      )
    ).toEqual(
      expect.objectContaining({
        decision: 'AUTO_EXECUTE',
        requiresApproval: false,
      })
    );
  });

  it('never mutates automatically while the company is in suggest-only mode', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'UPDATE_TASK_STATUS',
          riskLevel: 'LOW',
          statusProposal: 'ACCEPTED',
        },
        { ...baseSettings, autonomyMode: 'SUGGEST_ONLY' }
      )
    ).toEqual(
      expect.objectContaining({
        decision: 'SUGGEST',
        requiresApproval: true,
      })
    );
  });

  it('requires owner approval before a hot conversation handoff', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'OFFER_CONVERSATION_HANDOFF',
          riskLevel: 'HIGH',
        },
        baseSettings
      )
    ).toEqual(
      expect.objectContaining({
        decision: 'REQUIRE_APPROVAL',
        requiresApproval: true,
      })
    );
  });

  it('always requires approval before storing a manager policy', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'CREATE_POLICY',
          riskLevel: 'LOW',
        },
        { ...baseSettings, autonomyMode: 'AUTO_LOW_RISK' }
      )
    ).toEqual(
      expect.objectContaining({
        decision: 'REQUIRE_APPROVAL',
        requiresApproval: true,
      })
    );
  });

  it('creates internal tasks automatically but respects assignment opt-in', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'CREATE_TASK',
          riskLevel: 'LOW',
          hasAutomaticAssignment: false,
        },
        baseSettings
      ).decision
    ).toBe('AUTO_EXECUTE');
    expect(
      evaluateActionPolicy(
        {
          actionType: 'CREATE_TASK',
          riskLevel: 'LOW',
          hasAutomaticAssignment: true,
        },
        baseSettings
      ).decision
    ).toBe('REQUIRE_APPROVAL');
  });

  it('always blocks binding price or legal commitments from automatic execution', () => {
    expect(
      evaluateActionPolicy(
        {
          actionType: 'NOTIFY_OWNER',
          riskLevel: 'CRITICAL',
          containsBindingCommitment: true,
        },
        { ...baseSettings, autonomyMode: 'AUTO_LOW_RISK' }
      ).decision
    ).toBe('REQUIRE_APPROVAL');
  });

  it('does not label a queued message as sent or delivered', () => {
    expect(deliveryPresentation('QUEUED')).toEqual({
      label: 'Kuyruğa alındı',
      terminal: false,
      successful: false,
    });
  });

  it('shows a provider failure as a failure', () => {
    expect(deliveryPresentation('FAILED')).toEqual(
      expect.objectContaining({
        label: expect.stringMatching(/teslim edilemedi/i),
        successful: false,
      })
    );
  });

  it('respects quiet hours for noncritical owner notifications', () => {
    const at2330Istanbul = new Date('2026-07-28T20:30:00.000Z');
    expect(
      shouldNotifyOwnerNow(
        { importance: 'NORMAL', eventType: 'TASK_ACCEPTED' },
        baseSettings,
        at2330Istanbul
      )
    ).toBe(false);
  });

  it('allows critical delivery failures even during quiet hours', () => {
    const at2330Istanbul = new Date('2026-07-28T20:30:00.000Z');
    expect(
      shouldNotifyOwnerNow(
        { importance: 'CRITICAL', eventType: 'MESSAGE_DELIVERY_FAILED' },
        baseSettings,
        at2330Istanbul
      )
    ).toBe(true);
  });

  it('delivers an explicitly enabled manager summary outside quiet hours', () => {
    const at1200Istanbul = new Date('2026-07-28T09:00:00.000Z');
    expect(
      shouldNotifyOwnerNow(
        { importance: 'NORMAL', eventType: 'MANAGER_SUMMARY' },
        baseSettings,
        at1200Istanbul
      )
    ).toBe(true);
  });

  it('still suppresses manager summaries during quiet hours', () => {
    const at2330Istanbul = new Date('2026-07-28T20:30:00.000Z');
    expect(
      shouldNotifyOwnerNow(
        { importance: 'NORMAL', eventType: 'MANAGER_SUMMARY' },
        baseSettings,
        at2330Istanbul
      )
    ).toBe(false);
  });
});
