import { describe, expect, it } from 'vitest';
import {
  buildMemberOperationalPayload,
  parseMemberList,
} from './company-member-form';

describe('company member form payload', () => {
  it('normalizes lists and builds a weekday work schedule', () => {
    const payload = buildMemberOperationalPayload({
      phone: '+905551112233',
      role: 'MANAGER',
      phoneVerificationStatus: 'VERIFIED',
      canReceiveWhatsAppTasks: 'on',
      allowAutomaticInternalMessages: 'on',
      preferredLanguage: 'tr-TR',
      availability: 'AVAILABLE',
      specialtyRegions: 'Alanya, Kestel, Alanya',
      specialties: 'Villa, Satılık konut, Villa',
      maxActiveTaskCapacity: '18',
      workHoursEnabled: 'on',
      workHoursTimezone: 'Europe/Istanbul',
      workHoursStart: '09:30',
      workHoursEnd: '18:30',
      workDay_MONDAY: 'on',
      workDay_WEDNESDAY: 'on',
      workDay_FRIDAY: 'on',
    });

    expect(payload).toEqual({
      role: 'MANAGER',
      canReceiveWhatsAppTasks: true,
      allowAutomaticInternalMessages: true,
      preferredLanguage: 'tr-TR',
      availability: 'AVAILABLE',
      specialtyRegions: ['Alanya', 'Kestel'],
      specialties: ['Villa', 'Satılık konut'],
      maxActiveTaskCapacity: 18,
      workHours: {
        timezone: 'Europe/Istanbul',
        days: [
          { day: 'MONDAY', enabled: true, start: '09:30', end: '18:30' },
          { day: 'WEDNESDAY', enabled: true, start: '09:30', end: '18:30' },
          { day: 'FRIDAY', enabled: true, start: '09:30', end: '18:30' },
        ],
      },
    });
  });

  it('disables phone-dependent automation without a phone number', () => {
    const payload = buildMemberOperationalPayload({
      phone: '',
      phoneVerificationStatus: 'VERIFIED',
      canReceiveWhatsAppTasks: 'on',
      allowAutomaticInternalMessages: 'on',
      workHoursEnabled: '',
    });

    expect(payload.phoneVerificationStatus).toBeUndefined();
    expect(payload.canReceiveWhatsAppTasks).toBe(false);
    expect(payload.allowAutomaticInternalMessages).toBe(false);
    expect(payload.workHours).toBeNull();
  });

  it('does not enable automatic messages when WhatsApp tasks are disabled', () => {
    const payload = buildMemberOperationalPayload({
      phone: '+905551112233',
      canReceiveWhatsAppTasks: '',
      allowAutomaticInternalMessages: 'on',
    });

    expect(payload.canReceiveWhatsAppTasks).toBe(false);
    expect(payload.allowAutomaticInternalMessages).toBe(false);
  });

  it('trims, removes duplicates and ignores empty list items', () => {
    expect(parseMemberList(' Kestel, , Mahmutlar, Kestel ')).toEqual([
      'Kestel',
      'Mahmutlar',
    ]);
  });
});
