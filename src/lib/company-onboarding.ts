import { z } from 'zod';

const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı.');

const shortTextSchema = z.string().trim().max(160);
const listSchema = z.array(shortTextSchema.min(1)).max(20);

const websiteSchema = z
  .object({
    status: z.enum(['NONE', 'EXISTING', 'REQUESTED']),
    url: z.string().trim().max(2_048),
    hostingProvider: z.string().trim().max(120),
  })
  .strict();

const integrationSchema = z.enum(['NOT_CONNECTED', 'PLANNED', 'CONNECTED']);

const integrationsSchema = z
  .object({
    whatsapp: integrationSchema,
    googleCalendar: integrationSchema,
  })
  .strict();

const communicationSchema = z
  .object({
    quietHoursEnabled: z.boolean(),
    quietHoursStart: clockSchema,
    quietHoursEnd: clockSchema,
  })
  .strict();

const operationsSchema = z
  .object({
    customerResponseMinutes: z.number().int().min(1).max(240),
    employeeAcknowledgementMinutes: z.number().int().min(5).max(120),
    ownerEscalationMinutes: z.number().int().min(5).max(240),
    ownerNoResponseAction: z.enum([
      'CREATE_CRITICAL_TASK',
      'RETRY_AND_ALERT',
      'PAUSE_AUTOMATION',
    ]),
    appointmentReminderHours: z.number().int().min(1).max(72),
    appointmentOutcomeDelayMinutes: z.number().int().min(5).max(1_440),
  })
  .strict();

const automationsSchema = z
  .object({
    automaticEmployeeAssignment: z.boolean(),
    automaticEmployeeWhatsApp: z.boolean(),
    hotLeadAlerts: z.boolean(),
    morningSummary: z.boolean(),
    eveningSummary: z.boolean(),
  })
  .strict();

export const companyOnboardingProfileSchema = z
  .object({
    version: z.literal(2),
    companyName: z.string().trim().min(2).max(160),
    ownerPhone: z.string().trim().max(40),
    timezone: z.string().trim().min(1).max(64),
    strengths: listSchema,
    uniquePoints: listSchema,
    serviceAreas: listSchema,
    yearsInBusiness: z.number().int().min(0).max(250),
    teamSize: z.number().int().min(1).max(10_000),
    extraNotes: z.string().trim().max(4_000),
    website: websiteSchema,
    integrations: integrationsSchema,
    communication: communicationSchema,
    operations: operationsSchema,
    automations: automationsSchema,
    setupDisposition: z.enum(['IN_PROGRESS', 'DEFERRED', 'COMPLETED']),
    currentStep: z.number().int().min(1).max(6),
  })
  .strict();

export type CompanyOnboardingProfile = z.infer<
  typeof companyOnboardingProfileSchema
>;

export const companyOnboardingRequestSchema = companyOnboardingProfileSchema
  .extend({
    completed: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.completed && value.setupDisposition !== 'COMPLETED') {
      context.addIssue({
        code: 'custom',
        path: ['setupDisposition'],
        message: 'Tamamlanan kurulumun durumu COMPLETED olmalı.',
      });
    }
    if (!value.completed && value.setupDisposition === 'COMPLETED') {
      context.addIssue({
        code: 'custom',
        path: ['completed'],
        message: 'COMPLETED durumundaki kurulum tamamlanmış olmalı.',
      });
    }
    if (value.website.status === 'EXISTING') {
      const parsedUrl = z.string().url().safeParse(value.website.url);
      if (!parsedUrl.success) {
        context.addIssue({
          code: 'custom',
          path: ['website', 'url'],
          message: 'Mevcut web sitesi için geçerli bir adres girin.',
        });
      }
    }
  });

export type CompanyOnboardingRequest = z.infer<
  typeof companyOnboardingRequestSchema
>;

export function defaultCompanyOnboardingProfile(
  companyName: string
): CompanyOnboardingProfile {
  const normalizedCompanyName = companyName.trim() || 'Şirketim';

  return {
    version: 2,
    companyName: normalizedCompanyName,
    ownerPhone: '',
    timezone: 'Europe/Istanbul',
    strengths: [],
    uniquePoints: [],
    serviceAreas: [],
    yearsInBusiness: 0,
    teamSize: 1,
    extraNotes: '',
    website: {
      status: 'NONE',
      url: '',
      hostingProvider: '',
    },
    integrations: {
      whatsapp: 'NOT_CONNECTED',
      googleCalendar: 'NOT_CONNECTED',
    },
    communication: {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    operations: {
      customerResponseMinutes: 15,
      employeeAcknowledgementMinutes: 15,
      ownerEscalationMinutes: 15,
      ownerNoResponseAction: 'CREATE_CRITICAL_TASK',
      appointmentReminderHours: 24,
      appointmentOutcomeDelayMinutes: 30,
    },
    automations: {
      automaticEmployeeAssignment: false,
      automaticEmployeeWhatsApp: false,
      hotLeadAlerts: true,
      morningSummary: true,
      eveningSummary: true,
    },
    setupDisposition: 'IN_PROGRESS',
    currentStep: 1,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Converts the original flat onboarding payload to the versioned profile while
 * also repairing incomplete version-2 drafts with safe defaults.
 */
export function normalizeCompanyOnboardingState(
  value: unknown,
  companyName: string
): CompanyOnboardingProfile {
  const defaults = defaultCompanyOnboardingProfile(companyName);
  const source = objectValue(value);
  const candidate = {
    ...defaults,
    ...source,
    version: 2 as const,
    companyName:
      typeof source.companyName === 'string' && source.companyName.trim()
        ? source.companyName
        : defaults.companyName,
    website: {
      ...defaults.website,
      ...objectValue(source.website),
    },
    integrations: {
      ...defaults.integrations,
      ...objectValue(source.integrations),
    },
    communication: {
      ...defaults.communication,
      ...objectValue(source.communication),
    },
    operations: {
      ...defaults.operations,
      ...objectValue(source.operations),
    },
    automations: {
      ...defaults.automations,
      ...objectValue(source.automations),
    },
  };

  const parsed = companyOnboardingProfileSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // A malformed historic field must not make the entire setup inaccessible.
  // Copy only individually valid legacy fields onto a known-safe profile.
  const legacy = { ...defaults };
  const copyList = (key: 'strengths' | 'uniquePoints' | 'serviceAreas') => {
    const parsedList = listSchema.safeParse(source[key]);
    if (parsedList.success) legacy[key] = parsedList.data;
  };
  copyList('strengths');
  copyList('uniquePoints');
  copyList('serviceAreas');

  const years = z.number().int().min(0).max(250).safeParse(source.yearsInBusiness);
  if (years.success) legacy.yearsInBusiness = years.data;
  const teamSize = z.number().int().min(1).max(10_000).safeParse(source.teamSize);
  if (teamSize.success) legacy.teamSize = teamSize.data;
  const notes = z.string().trim().max(4_000).safeParse(source.extraNotes);
  if (notes.success) legacy.extraNotes = notes.data;

  return legacy;
}

export function managerPreferencesFromOnboarding(
  profile: CompanyOnboardingProfile
) {
  return {
    ownerPhone: profile.ownerPhone || null,
    timezone: profile.timezone,
    alwaysNotifyHotLeads: profile.automations.hotLeadAlerts,
    morningSummaryEnabled: profile.automations.morningSummary,
    eveningSummaryEnabled: profile.automations.eveningSummary,
    quietHoursEnabled: profile.communication.quietHoursEnabled,
    quietHoursStart: profile.communication.quietHoursStart,
    quietHoursEnd: profile.communication.quietHoursEnd,
    allowAutomaticEmployeeAssignment:
      profile.automations.automaticEmployeeAssignment,
    allowAutomaticEmployeeWhatsApp:
      profile.automations.automaticEmployeeWhatsApp,
  };
}
