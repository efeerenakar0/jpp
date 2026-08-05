import { describe, expect, it } from 'vitest';

import {
  companyOnboardingRequestSchema,
  defaultCompanyOnboardingProfile,
  managerPreferencesFromOnboarding,
  normalizeCompanyOnboardingState,
} from './company-onboarding';

describe('şirket ilk kurulumu', () => {
  it('yeni şirket için güvenli ve uygulanabilir varsayılanlar üretir', () => {
    const profile = defaultCompanyOnboardingProfile('Akar Group');

    expect(profile.version).toBe(2);
    expect(profile.companyName).toBe('Akar Group');
    expect(profile.setupDisposition).toBe('IN_PROGRESS');
    expect(profile.operations.employeeAcknowledgementMinutes).toBe(15);
    expect(profile.operations.ownerEscalationMinutes).toBe(15);
    expect(profile.automations.automaticEmployeeWhatsApp).toBe(false);
  });

  it('eski onboarding JSON kaydını veri kaybetmeden sürüm 2 yapısına taşır', () => {
    const profile = normalizeCompanyOnboardingState(
      {
        strengths: ['Hızlı satış'],
        serviceAreas: ['Alanya'],
        yearsInBusiness: 7,
        extraNotes: 'Samimi konuş.',
      },
      'Jasmine Group'
    );

    expect(profile.companyName).toBe('Jasmine Group');
    expect(profile.strengths).toEqual(['Hızlı satış']);
    expect(profile.serviceAreas).toEqual(['Alanya']);
    expect(profile.yearsInBusiness).toBe(7);
    expect(profile.extraNotes).toBe('Samimi konuş.');
    expect(profile.operations.customerResponseMinutes).toBe(15);
  });

  it('erteleme ile tamamlamayı birbirinden ayırır', () => {
    const base = defaultCompanyOnboardingProfile('Akar Group');
    const deferred = companyOnboardingRequestSchema.parse({
      ...base,
      setupDisposition: 'DEFERRED',
      completed: false,
    });

    expect(deferred.completed).toBe(false);
    expect(deferred.setupDisposition).toBe('DEFERRED');
  });

  it('operasyon sürelerini sınırlar ve bilinmeyen secret alanlarını reddeder', () => {
    const base = defaultCompanyOnboardingProfile('Akar Group');

    expect(
      companyOnboardingRequestSchema.safeParse({
        ...base,
        completed: true,
        operations: {
          ...base.operations,
          employeeAcknowledgementMinutes: 0,
        },
      }).success
    ).toBe(false);

    expect(
      companyOnboardingRequestSchema.safeParse({
        ...base,
        completed: true,
        apiKey: 'secret-must-never-be-accepted',
      }).success
    ).toBe(false);
  });

  it('seçilen otomasyonları mevcut çalışan/patron politika modeline bağlar', () => {
    const profile = defaultCompanyOnboardingProfile('Akar Group');
    profile.ownerPhone = '+905551112233';
    profile.timezone = 'Europe/Istanbul';
    profile.automations.automaticEmployeeAssignment = true;
    profile.automations.automaticEmployeeWhatsApp = true;
    profile.automations.hotLeadAlerts = false;
    profile.communication.quietHoursEnabled = false;

    expect(managerPreferencesFromOnboarding(profile)).toEqual(
      expect.objectContaining({
        ownerPhone: '+905551112233',
        timezone: 'Europe/Istanbul',
        allowAutomaticEmployeeAssignment: true,
        allowAutomaticEmployeeWhatsApp: true,
        alwaysNotifyHotLeads: false,
        quietHoursEnabled: false,
      })
    );
  });
});
