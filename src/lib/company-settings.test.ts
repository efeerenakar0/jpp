import { describe, expect, it } from 'vitest';

import {
  companySettingsRequestSchema,
  defaultCompanySettings,
  normalizeCompanySettings,
  nextDataProcessingTimeline,
  toLegacyOnboardingProfile,
  validateEscalationMembers,
} from './company-settings';

describe('şirket ayarları alan modeli', () => {
  it('yeni şirket için 15 dakika yanıt ve 5 dakika hatırlatma varsayılanı üretir', () => {
    const settings = defaultCompanySettings('Akar Group');

    expect(settings.company.name).toBe('Akar Group');
    expect(settings.operations.customerResponseMinutes).toBe(15);
    expect(settings.operations.employeeReminderMinutes).toBe(5);
    expect(settings.operations.employeeAcknowledgementMinutes).toBe(15);
    expect(settings.setup.disposition).toBe('IN_PROGRESS');
  });

  it('eski onboarding kaydındaki operasyon ve otomasyon tercihlerini korur', () => {
    const settings = normalizeCompanySettings({
      account: {
        companyName: 'Jasmine Group',
        brandLogoData: null,
        ownerPhone: '+905551112233',
        timezone: 'Europe/Istanbul',
        onboardingCompletedAt: null,
        onboardingState: {
          version: 2,
          companyName: 'Jasmine Group',
          ownerPhone: '+905551112233',
          timezone: 'Europe/Istanbul',
          website: {
            status: 'EXISTING',
            url: 'https://jasmine.example',
            hostingProvider: 'Vercel',
          },
          operations: {
            customerResponseMinutes: 20,
            employeeAcknowledgementMinutes: 25,
            ownerEscalationMinutes: 30,
            ownerNoResponseAction: 'PAUSE_AUTOMATION',
            appointmentReminderHours: 24,
            appointmentOutcomeDelayMinutes: 30,
          },
          automations: {
            automaticEmployeeAssignment: true,
            automaticEmployeeWhatsApp: false,
            hotLeadAlerts: true,
            morningSummary: false,
            eveningSummary: true,
          },
        },
      },
      persisted: null,
      escalationMemberIds: [],
    });

    expect(settings.website.url).toBe('https://jasmine.example');
    expect(settings.operations.customerResponseMinutes).toBe(20);
    expect(settings.operations.employeeAcknowledgementMinutes).toBe(25);
    expect(settings.operations.ownerNoResponseAction).toBe('PAUSE_AUTOMATION');
    expect(settings.aiPermissions.automaticEmployeeAssignment).toBe(true);
    expect(settings.notifications.morningSummary).toBe(false);
  });

  it('javascript URL, gizli alan ve yinelenen eskalasyon çalışanını reddeder', () => {
    const base = defaultCompanySettings('Akar Group');

    expect(
      companySettingsRequestSchema.safeParse({
        ...base,
        website: { ...base.website, status: 'EXISTING', url: 'javascript:alert(1)' },
      }).success
    ).toBe(false);

    expect(
      companySettingsRequestSchema.safeParse({
        ...base,
        apiKey: 'secret-must-not-be-accepted',
      }).success
    ).toBe(false);

    expect(
      companySettingsRequestSchema.safeParse({
        ...base,
        escalationMemberIds: ['member-a', 'member-a'],
      }).success
    ).toBe(false);
  });

  it('çalışma saatlerini ve zamanlama ilişkisini doğrular', () => {
    const base = defaultCompanySettings('Akar Group');
    const monday = base.workHours[0];

    expect(
      companySettingsRequestSchema.safeParse({
        ...base,
        workHours: [
          { ...monday, start: '18:00', end: '09:00' },
          ...base.workHours.slice(1),
        ],
      }).success
    ).toBe(false);

    expect(
      companySettingsRequestSchema.safeParse({
        ...base,
        operations: {
          ...base.operations,
          employeeReminderMinutes: 20,
          employeeAcknowledgementMinutes: 15,
        },
      }).success
    ).toBe(false);
  });

  it('yeni ayarları mevcut onboarding tüketicileri için sürüm 2 profile dönüştürür', () => {
    const settings = defaultCompanySettings('Akar Group');
    settings.company.contactPhone = '+905551112233';
    settings.operations.customerResponseMinutes = 12;
    settings.aiPermissions.automaticEmployeeAssignment = true;
    settings.setup.disposition = 'COMPLETED';
    settings.setup.currentStep = 7;

    const legacy = toLegacyOnboardingProfile(settings, {
      strengths: ['Bölge uzmanlığı'],
    });

    expect(legacy.version).toBe(2);
    expect(legacy.ownerPhone).toBe('+905551112233');
    expect(legacy.operations.customerResponseMinutes).toBe(12);
    expect(legacy.automations.automaticEmployeeAssignment).toBe(true);
    expect(legacy.strengths).toEqual(['Bölge uzmanlığı']);
    expect(legacy.setupDisposition).toBe('COMPLETED');
  });

  it('başka tenant çalışanını veya pasif çalışanı eskalasyon sırasına almaz', () => {
    const members = [
      {
        id: 'member-a',
        companyAccountId: 'company-a',
        active: true,
        canReceiveWhatsAppTasks: true,
      },
      {
        id: 'member-b',
        companyAccountId: 'company-b',
        active: true,
        canReceiveWhatsAppTasks: true,
      },
      {
        id: 'member-c',
        companyAccountId: 'company-a',
        active: false,
        canReceiveWhatsAppTasks: true,
      },
    ];

    expect(() =>
      validateEscalationMembers(['member-a'], members, 'company-a')
    ).not.toThrow();
    expect(() =>
      validateEscalationMembers(['member-b'], members, 'company-a')
    ).toThrow(/yalnız aktif/i);
    expect(() =>
      validateEscalationMembers(['member-c'], members, 'company-a')
    ).toThrow(/yalnız aktif/i);
  });

  it('veri işleme izni kapalı kalırken önceki geri çekme zamanını korur', () => {
    const acceptedAt = new Date('2026-08-01T10:00:00.000Z');
    const revokedAt = new Date('2026-08-02T10:00:00.000Z');
    const now = new Date('2026-08-06T10:00:00.000Z');

    expect(
      nextDataProcessingTimeline({
        wasAccepted: false,
        acceptedAt,
        revokedAt,
        accepted: false,
        now,
      })
    ).toEqual({ acceptedAt, revokedAt });
  });
});
