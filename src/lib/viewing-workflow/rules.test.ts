import { describe, expect, it } from 'vitest';

import {
  acknowledgementDeadline,
  correlateInteractionPrompt,
  expectedResponseTypesForAction,
  parseAppointmentInstruction,
  parseFollowUpDate,
  parseInteractionReply,
  appointmentOutcomeForAction,
  appointmentLifecycleDecision,
  shouldTimeoutAssignment,
} from './rules';

const prompt = {
  id: 'prompt-1',
  shortCode: 'V7K2',
  recipientId: 'member-1',
  expectedResponseType: 'ASSIGNMENT_ACK' as const,
  sentProviderMessageId: 'provider-out-1',
  status: 'OPEN' as const,
};

describe('viewing prompt correlation and ACK rules', () => {
  it('starts the 15 minute ACK deadline from actual delivery time', () => {
    const sentAt = new Date('2026-08-02T12:00:00.000Z');
    expect(acknowledgementDeadline(sentAt).toISOString()).toBe(
      '2026-08-02T12:15:00.000Z'
    );
    expect(
      shouldTimeoutAssignment({
        status: 'AWAITING_ACK',
        ackDeadlineAt: acknowledgementDeadline(sentAt),
        now: new Date('2026-08-02T12:14:59.000Z'),
      })
    ).toBe(false);
    expect(
      shouldTimeoutAssignment({
        status: 'AWAITING_SEND',
        ackDeadlineAt: null,
        now: new Date('2026-08-02T13:00:00.000Z'),
      })
    ).toBe(false);
  });

  it('uses a validated tenant ACK duration and rejects unsafe values', () => {
    const sentAt = new Date('2026-08-02T12:00:00.000Z');
    expect(acknowledgementDeadline(sentAt, 35).toISOString()).toBe(
      '2026-08-02T12:35:00.000Z'
    );
    expect(acknowledgementDeadline(sentAt, 0).toISOString()).toBe(
      '2026-08-02T12:15:00.000Z'
    );
    expect(acknowledgementDeadline(sentAt, Number.NaN).toISOString()).toBe(
      '2026-08-02T12:15:00.000Z'
    );
  });

  it('prioritizes quoted provider id, then short code, then a sole prompt', () => {
    const other = {
      ...prompt,
      id: 'prompt-2',
      shortCode: 'V8M3',
      sentProviderMessageId: 'provider-out-2',
    };
    expect(
      correlateInteractionPrompt({
        prompts: [prompt, other],
        recipientId: 'member-1',
        expectedResponseType: 'ASSIGNMENT_ACK',
        text: '#V8M3 KABUL',
        quotedProviderMessageId: 'provider-out-1',
      }).prompt?.id
    ).toBe('prompt-1');
    expect(
      correlateInteractionPrompt({
        prompts: [prompt, other],
        recipientId: 'member-1',
        expectedResponseType: 'ASSIGNMENT_ACK',
        text: '#V8M3 KABUL',
        quotedProviderMessageId: null,
      }).prompt?.id
    ).toBe('prompt-2');
  });

  it('does not mutate on ambiguous unscoped replies', () => {
    const result = correlateInteractionPrompt({
      prompts: [
        prompt,
        { ...prompt, id: 'prompt-2', shortCode: 'V8M3' },
      ],
      recipientId: 'member-1',
      expectedResponseType: 'ASSIGNMENT_ACK',
      text: 'kabul',
      quotedProviderMessageId: null,
    });
    expect(result.prompt).toBeNull();
    expect(result.reason).toBe('AMBIGUOUS');
  });

  it('parses assignment and owner decision replies deterministically', () => {
    expect(parseInteractionReply('#V7K2 KABUL')).toMatchObject({
      shortCode: 'V7K2',
      action: 'ACCEPT',
    });
    expect(parseInteractionReply('#V7K2 RED: başka randevum var')).toMatchObject(
      { action: 'REJECT', reason: 'başka randevum var' }
    );
    expect(parseInteractionReply("#V7K2 2'YE ATA")).toMatchObject({
      action: 'REASSIGN',
      candidateIndex: 2,
    });
    expect(parseInteractionReply('#S9P2 KALDIR')).toMatchObject({
      action: 'REMOVE_SOLD_PROPERTY',
    });
  });

  it('maps replies only to compatible open prompt types', () => {
    expect(expectedResponseTypesForAction('ACCEPT')).toEqual([
      'ASSIGNMENT_ACK',
    ]);
    expect(expectedResponseTypesForAction('REMOVE_SOLD_PROPERTY')).toEqual([
      'SALE_DECISION',
    ]);
    expect(expectedResponseTypesForAction('CANCEL')).toEqual([
      'OWNER_REASSIGNMENT_DECISION',
      'APPOINTMENT_OUTCOME',
    ]);
  });

  it('accepts only explicit, timezone-aware appointment instructions', () => {
    expect(
      parseAppointmentInstruction(
        '#V7K2 RANDEVU 05.08.2026 14:30',
        'Europe/Istanbul'
      )
    ).toMatchObject({
      shortCode: 'V7K2',
      startAt: '2026-08-05T11:30:00.000Z',
    });
    expect(
      parseAppointmentInstruction('#V7K2 yarın görüşürüz', 'Europe/Istanbul')
    ).toBeNull();
  });

  it('maps explicit employee outcome replies without AI inference', () => {
    expect(appointmentOutcomeForAction('SOLD_REPORTED')).toBe('SOLD_REPORTED');
    expect(appointmentOutcomeForAction('NOT_SOLD')).toBe('NOT_SOLD');
    expect(appointmentOutcomeForAction('FOLLOW_UP')).toBe('FOLLOW_UP');
    expect(appointmentOutcomeForAction('DETAIL')).toBeNull();
  });

  it('extracts an optional follow-up date using the company timezone', () => {
    expect(
      parseFollowUpDate('müşteriyi 08.08.2026 10:00 tarihinde ara', 'Europe/Istanbul')
        ?.toISOString()
    ).toBe('2026-08-08T07:00:00.000Z');
    expect(parseFollowUpDate('haftaya ara', 'Europe/Istanbul')).toBeNull();
  });

  it('drives reminder and result stages from injected time', () => {
    const startAt = new Date('2026-08-05T11:00:00.000Z');
    const endAt = new Date('2026-08-05T12:00:00.000Z');
    expect(
      appointmentLifecycleDecision({
        now: new Date('2026-08-04T11:00:00.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: null,
        outcomePromptSentAt: null,
        hasOutcome: false,
      })
    ).toBe('SEND_CONFIRMATION');
    expect(
      appointmentLifecycleDecision({
        appointmentReminderHours: 36,
        appointmentOutcomeDelayMinutes: 90,
        now: new Date('2026-08-03T23:00:00.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: null,
        outcomePromptSentAt: null,
        hasOutcome: false,
      })
    ).toBe('SEND_CONFIRMATION');
    expect(
      appointmentLifecycleDecision({
        appointmentReminderHours: 36,
        appointmentOutcomeDelayMinutes: 90,
        now: new Date('2026-08-05T13:29:59.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: new Date('2026-08-03T23:00:00.000Z'),
        outcomePromptSentAt: null,
        hasOutcome: false,
      })
    ).toBe('NONE');
    expect(
      appointmentLifecycleDecision({
        appointmentReminderHours: 36,
        appointmentOutcomeDelayMinutes: 90,
        now: new Date('2026-08-05T13:30:00.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: new Date('2026-08-03T23:00:00.000Z'),
        outcomePromptSentAt: null,
        hasOutcome: false,
      })
    ).toBe('SEND_OUTCOME');
    expect(
      appointmentLifecycleDecision({
        now: new Date('2026-08-05T12:30:00.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: new Date('2026-08-04T11:00:00.000Z'),
        outcomePromptSentAt: null,
        hasOutcome: false,
      })
    ).toBe('SEND_OUTCOME');
    expect(
      appointmentLifecycleDecision({
        now: new Date('2026-08-05T12:30:00.000Z'),
        startAt,
        endAt,
        employeeReminderSentAt: new Date('2026-08-04T11:00:00.000Z'),
        outcomePromptSentAt: null,
        hasOutcome: true,
      })
    ).toBe('NONE');
  });
});
