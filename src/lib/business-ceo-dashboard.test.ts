import { describe, expect, it } from 'vitest';
import {
  BUSINESS_CEO_MODULES,
  deriveSalesConversationStatus,
  latestConversationMessage,
} from './business-ceo-dashboard';

describe('Business CEO AI dashboard catalog', () => {
  it('keeps the requested workflow and secondary modules in a stable order', () => {
    expect(BUSINESS_CEO_MODULES.workflow.map((module) => module.key)).toEqual([
      'portfolio-specialist',
      'studio',
      'advertising-design',
      'marketing-specialist',
    ]);
    expect(BUSINESS_CEO_MODULES.secondary.map((module) => module.key)).toEqual([
      'developer',
      'partner-finder',
      'authorized-pool',
      'deed-tracking',
      'company-ceo',
    ]);
  });

  it('never exposes duplicate destinations', () => {
    const hrefs = [
      ...BUSINESS_CEO_MODULES.workflow,
      ...BUSINESS_CEO_MODULES.secondary,
    ].map((module) => module.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('routes the shared pool and deed workflow to their dedicated workspaces', () => {
    expect(
      BUSINESS_CEO_MODULES.secondary.find((module) => module.key === 'authorized-pool')
        ?.href
    ).toBe('/fabrika/yetkili-havuz');
    expect(
      BUSINESS_CEO_MODULES.secondary.find((module) => module.key === 'deed-tracking')
        ?.href
    ).toBe('/fabrika/tapu-takip');
  });
});

describe('sales expert conversation helpers', () => {
  it('uses the newest message instead of trusting the array order', () => {
    const result = latestConversationMessage([
      { id: 'new', role: 'customer', content: 'Yeni', createdAt: '2026-08-05T12:00:00.000Z' },
      { id: 'old', role: 'assistant', content: 'Eski', createdAt: '2026-08-05T10:00:00.000Z' },
    ]);

    expect(result?.id).toBe('new');
  });

  it('marks a customer message as waiting and a pending viewing as an appointment', () => {
    expect(
      deriveSalesConversationStatus({
        latestRole: 'customer',
        messageCount: 4,
        appointmentStatuses: [],
      })
    ).toBe('WAITING');

    expect(
      deriveSalesConversationStatus({
        latestRole: 'assistant',
        messageCount: 8,
        appointmentStatuses: ['PENDING'],
      })
    ).toBe('APPOINTMENT');
  });

  it('keeps a conversation with no messages in a neutral state', () => {
    expect(
      deriveSalesConversationStatus({
        latestRole: null,
        messageCount: 0,
        appointmentStatuses: [],
      })
    ).toBe('NEW');
  });
});
