import { z } from 'zod';

import {
  defaultCompanyOnboardingProfile,
  normalizeCompanyOnboardingState,
  type CompanyOnboardingProfile,
} from './company-onboarding';

const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı.');

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Yalnız geçerli http veya https adresi girin.');

const optionalEmailSchema = z.union([
  z.literal(''),
  z.string().trim().email('Geçerli bir e-posta adresi girin.').max(320),
]);

const logoDataSchema = z.union([
  z.null(),
  z.literal(''),
  z
    .string()
    .max(3_000_000, 'Logo dosyası en fazla 2 MB olabilir.')
    .regex(
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Logo PNG, JPG veya WEBP olmalı.'
    ),
]);

const companySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    logoData: logoDataSchema,
    address: z.string().trim().max(1_000),
    city: z.string().trim().max(120),
    district: z.string().trim().max(120),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    contactEmail: optionalEmailSchema,
    contactPhone: z.string().trim().max(40),
    timezone: z.string().trim().min(1).max(64),
    locale: z.enum(['tr-TR', 'en-US', 'de-DE', 'ru-RU']),
  })
  .strict();

const websiteSchema = z
  .object({
    status: z.enum(['NONE', 'EXISTING', 'REQUESTED']),
    url: optionalHttpUrlSchema,
    hostingProvider: z.string().trim().max(120),
  })
  .strict();

const socialLinksSchema = z
  .object({
    instagram: optionalHttpUrlSchema,
    facebook: optionalHttpUrlSchema,
    tiktok: optionalHttpUrlSchema,
    x: optionalHttpUrlSchema,
    linkedin: optionalHttpUrlSchema,
  })
  .strict();

export const companyWorkDaySchema = z
  .object({
    day: z.enum([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]),
    enabled: z.boolean(),
    start: clockSchema,
    end: clockSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled && value.start >= value.end) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Bitiş saati başlangıç saatinden sonra olmalı.',
      });
    }
  });

const operationsSchema = z
  .object({
    customerResponseMinutes: z.number().int().min(1).max(240),
    employeeReminderMinutes: z.number().int().min(1).max(60),
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

const notificationsSchema = z
  .object({
    criticalImmediately: z.boolean(),
    hotLead: z.boolean(),
    authorization: z.boolean(),
    appointment: z.boolean(),
    systemError: z.boolean(),
    taskFailure: z.boolean(),
    morningSummary: z.boolean(),
    eveningSummary: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: clockSchema,
    quietHoursEnd: clockSchema,
  })
  .strict();

const aiPermissionsSchema = z
  .object({
    automaticEmployeeAssignment: z.boolean(),
    automaticEmployeeWhatsApp: z.boolean(),
    customerAutoReply: z.boolean(),
    salesAuthorityOutreach: z.boolean(),
  })
  .strict();

const dataProcessingSchema = z
  .object({
    accepted: z.boolean(),
    consentVersion: z.literal('2026-08-v1'),
  })
  .strict();

const setupSchema = z
  .object({
    disposition: z.enum(['IN_PROGRESS', 'DEFERRED', 'COMPLETED']),
    currentStep: z.number().int().min(1).max(7),
  })
  .strict();

export const companySettingsRequestSchema = z
  .object({
    version: z.literal(1),
    company: companySchema,
    website: websiteSchema,
    socialLinks: socialLinksSchema,
    workHours: z.array(companyWorkDaySchema).length(7),
    operations: operationsSchema,
    escalationMemberIds: z.array(z.string().trim().min(1).max(120)).max(100),
    notifications: notificationsSchema,
    aiPermissions: aiPermissionsSchema,
    dataProcessing: dataProcessingSchema,
    setup: setupSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const days = value.workHours.map((entry) => entry.day);
    if (new Set(days).size !== 7) {
      context.addIssue({
        code: 'custom',
        path: ['workHours'],
        message: 'Her gün yalnızca bir kez tanımlanmalı.',
      });
    }

    if (new Set(value.escalationMemberIds).size !== value.escalationMemberIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['escalationMemberIds'],
        message: 'Bir çalışan eskalasyon sırasında yalnızca bir kez bulunabilir.',
      });
    }

    if (
      value.operations.employeeReminderMinutes >=
      value.operations.employeeAcknowledgementMinutes
    ) {
      context.addIssue({
        code: 'custom',
        path: ['operations', 'employeeReminderMinutes'],
        message: 'Hatırlatma aralığı çalışan cevap süresinden kısa olmalı.',
      });
    }

    if (value.website.status === 'EXISTING' && !value.website.url) {
      context.addIssue({
        code: 'custom',
        path: ['website', 'url'],
        message: 'Mevcut web sitesinin adresini girin.',
      });
    }

    try {
      new Intl.DateTimeFormat('tr-TR', { timeZone: value.company.timezone });
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['company', 'timezone'],
        message: 'Geçerli bir saat dilimi seçin.',
      });
    }
  });

export type CompanySettingsRequest = z.infer<typeof companySettingsRequestSchema>;
export type CompanyWorkDay = z.infer<typeof companyWorkDaySchema>;

export interface CompanySettingsMemberOption {
  id: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';
  phone: string | null;
  phoneVerified: boolean;
  canReceiveWhatsAppTasks: boolean;
}

export function nextDataProcessingTimeline(input: {
  wasAccepted: boolean;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  accepted: boolean;
  now: Date;
}) {
  if (input.accepted) {
    return {
      acceptedAt: input.wasAccepted ? input.acceptedAt ?? input.now : input.now,
      revokedAt: null,
    };
  }
  return {
    acceptedAt: input.acceptedAt,
    revokedAt: input.wasAccepted ? input.now : input.revokedAt,
  };
}

export function validateEscalationMembers(
  requestedIds: string[],
  members: Array<{
    id: string;
    companyAccountId: string;
    active: boolean;
    canReceiveWhatsAppTasks: boolean;
  }>,
  companyAccountId: string
) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const invalid = requestedIds.find((id) => {
    const member = byId.get(id);
    return (
      !member ||
      member.companyAccountId !== companyAccountId ||
      !member.active ||
      !member.canReceiveWhatsAppTasks
    );
  });

  if (invalid) {
    throw new Error('Eskalasyon sırası yalnız aktif ve uygun şirket çalışanlarını içerebilir.');
  }
}

const workDays: CompanyWorkDay['day'][] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export function defaultCompanySettings(companyName: string): CompanySettingsRequest {
  return {
    version: 1,
    company: {
      name: companyName.trim() || 'Şirketim',
      logoData: null,
      address: '',
      city: '',
      district: '',
      latitude: null,
      longitude: null,
      contactEmail: '',
      contactPhone: '',
      timezone: 'Europe/Istanbul',
      locale: 'tr-TR',
    },
    website: { status: 'NONE', url: '', hostingProvider: '' },
    socialLinks: {
      instagram: '',
      facebook: '',
      tiktok: '',
      x: '',
      linkedin: '',
    },
    workHours: workDays.map((day, index) => ({
      day,
      enabled: index < 5,
      start: '09:00',
      end: '18:00',
    })),
    operations: {
      customerResponseMinutes: 15,
      employeeReminderMinutes: 5,
      employeeAcknowledgementMinutes: 15,
      ownerEscalationMinutes: 15,
      ownerNoResponseAction: 'CREATE_CRITICAL_TASK',
      appointmentReminderHours: 24,
      appointmentOutcomeDelayMinutes: 30,
    },
    escalationMemberIds: [],
    notifications: {
      criticalImmediately: true,
      hotLead: true,
      authorization: true,
      appointment: true,
      systemError: true,
      taskFailure: true,
      morningSummary: true,
      eveningSummary: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    aiPermissions: {
      automaticEmployeeAssignment: false,
      automaticEmployeeWhatsApp: false,
      customerAutoReply: true,
      salesAuthorityOutreach: false,
    },
    dataProcessing: {
      accepted: false,
      consentVersion: '2026-08-v1',
    },
    setup: { disposition: 'IN_PROGRESS', currentStep: 1 },
  };
}

interface SettingsSnapshot {
  address?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string | null;
  websiteStatus?: string | null;
  websiteUrl?: string | null;
  hostingProvider?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  linkedinUrl?: string | null;
  workHours?: unknown;
  customerResponseMinutes?: number | null;
  employeeReminderMinutes?: number | null;
  employeeAcknowledgementMinutes?: number | null;
  ownerEscalationMinutes?: number | null;
  ownerNoResponseAction?: string | null;
  appointmentReminderHours?: number | null;
  appointmentOutcomeDelayMinutes?: number | null;
  ownerNotifications?: unknown;
  aiAutomationPermissions?: unknown;
  dataProcessingAccepted?: boolean | null;
  dataProcessingConsentVersion?: string | null;
  setupDisposition?: string | null;
  setupCurrentStep?: number | null;
}

interface AccountSnapshot {
  companyName: string;
  brandLogoData: string | null;
  ownerPhone: string | null;
  ownerEmail?: string | null;
  timezone: string;
  onboardingState: unknown;
  onboardingCompletedAt: Date | string | null;
}

function parseOr<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}

export function normalizeCompanySettings(input: {
  account: AccountSnapshot;
  persisted: SettingsSnapshot | null;
  escalationMemberIds: string[];
}): CompanySettingsRequest {
  const defaults = defaultCompanySettings(input.account.companyName);
  const legacy = normalizeCompanyOnboardingState(
    input.account.onboardingState,
    input.account.companyName
  );
  const row = input.persisted;

  const candidate: CompanySettingsRequest = {
    ...defaults,
    company: {
      ...defaults.company,
      name: input.account.companyName,
      logoData: input.account.brandLogoData,
      contactEmail: row?.contactEmail ?? input.account.ownerEmail ?? '',
      contactPhone: row?.contactPhone ?? input.account.ownerPhone ?? legacy.ownerPhone,
      timezone: input.account.timezone || legacy.timezone,
      address: row?.address ?? '',
      city: row?.city ?? '',
      district: row?.district ?? '',
      latitude: row?.latitude ?? null,
      longitude: row?.longitude ?? null,
      locale: parseOr(
        companySchema.shape.locale,
        row?.locale,
        defaults.company.locale
      ),
    },
    website: {
      status: parseOr(
        websiteSchema.shape.status,
        row?.websiteStatus ?? legacy.website.status,
        defaults.website.status
      ),
      url: row?.websiteUrl ?? legacy.website.url,
      hostingProvider: row?.hostingProvider ?? legacy.website.hostingProvider,
    },
    socialLinks: {
      instagram: row?.instagramUrl ?? '',
      facebook: row?.facebookUrl ?? '',
      tiktok: row?.tiktokUrl ?? '',
      x: row?.xUrl ?? '',
      linkedin: row?.linkedinUrl ?? '',
    },
    workHours: parseOr(
      z.array(companyWorkDaySchema).length(7),
      row?.workHours,
      defaults.workHours
    ),
    operations: {
      customerResponseMinutes:
        row?.customerResponseMinutes ?? legacy.operations.customerResponseMinutes,
      employeeReminderMinutes:
        row?.employeeReminderMinutes ?? defaults.operations.employeeReminderMinutes,
      employeeAcknowledgementMinutes:
        row?.employeeAcknowledgementMinutes ??
        legacy.operations.employeeAcknowledgementMinutes,
      ownerEscalationMinutes:
        row?.ownerEscalationMinutes ?? legacy.operations.ownerEscalationMinutes,
      ownerNoResponseAction: parseOr(
        operationsSchema.shape.ownerNoResponseAction,
        row?.ownerNoResponseAction ?? legacy.operations.ownerNoResponseAction,
        defaults.operations.ownerNoResponseAction
      ),
      appointmentReminderHours:
        row?.appointmentReminderHours ?? legacy.operations.appointmentReminderHours,
      appointmentOutcomeDelayMinutes:
        row?.appointmentOutcomeDelayMinutes ??
        legacy.operations.appointmentOutcomeDelayMinutes,
    },
    escalationMemberIds: input.escalationMemberIds,
    notifications: parseOr(
      notificationsSchema,
      row?.ownerNotifications,
      {
        ...defaults.notifications,
        hotLead: legacy.automations.hotLeadAlerts,
        morningSummary: legacy.automations.morningSummary,
        eveningSummary: legacy.automations.eveningSummary,
        quietHoursEnabled: legacy.communication.quietHoursEnabled,
        quietHoursStart: legacy.communication.quietHoursStart,
        quietHoursEnd: legacy.communication.quietHoursEnd,
      }
    ),
    aiPermissions: parseOr(
      aiPermissionsSchema,
      row?.aiAutomationPermissions,
      {
        ...defaults.aiPermissions,
        automaticEmployeeAssignment:
          legacy.automations.automaticEmployeeAssignment,
        automaticEmployeeWhatsApp: legacy.automations.automaticEmployeeWhatsApp,
      }
    ),
    dataProcessing: {
      accepted: row?.dataProcessingAccepted ?? false,
      consentVersion:
        row?.dataProcessingConsentVersion === '2026-08-v1'
          ? '2026-08-v1'
          : '2026-08-v1',
    },
    setup: {
      disposition: parseOr(
        setupSchema.shape.disposition,
        input.account.onboardingCompletedAt
          ? 'COMPLETED'
          : row?.setupDisposition ?? legacy.setupDisposition,
        defaults.setup.disposition
      ),
      currentStep: parseOr(
        setupSchema.shape.currentStep,
        input.account.onboardingCompletedAt ? 7 : row?.setupCurrentStep ?? legacy.currentStep,
        defaults.setup.currentStep
      ),
    },
  };

  const parsed = companySettingsRequestSchema.safeParse(candidate);
  return parsed.success ? parsed.data : defaults;
}

export function toLegacyOnboardingProfile(
  settings: CompanySettingsRequest,
  existingState: unknown
): CompanyOnboardingProfile {
  const existing = normalizeCompanyOnboardingState(
    existingState,
    settings.company.name
  );
  const fallback = defaultCompanyOnboardingProfile(settings.company.name);

  return {
    ...fallback,
    ...existing,
    version: 2,
    companyName: settings.company.name,
    ownerPhone: settings.company.contactPhone,
    timezone: settings.company.timezone,
    website: settings.website,
    communication: {
      quietHoursEnabled: settings.notifications.quietHoursEnabled,
      quietHoursStart: settings.notifications.quietHoursStart,
      quietHoursEnd: settings.notifications.quietHoursEnd,
    },
    operations: {
      customerResponseMinutes: settings.operations.customerResponseMinutes,
      employeeAcknowledgementMinutes:
        settings.operations.employeeAcknowledgementMinutes,
      ownerEscalationMinutes: settings.operations.ownerEscalationMinutes,
      ownerNoResponseAction: settings.operations.ownerNoResponseAction,
      appointmentReminderHours: settings.operations.appointmentReminderHours,
      appointmentOutcomeDelayMinutes:
        settings.operations.appointmentOutcomeDelayMinutes,
    },
    automations: {
      automaticEmployeeAssignment:
        settings.aiPermissions.automaticEmployeeAssignment,
      automaticEmployeeWhatsApp:
        settings.aiPermissions.automaticEmployeeWhatsApp,
      hotLeadAlerts: settings.notifications.hotLead,
      morningSummary: settings.notifications.morningSummary,
      eveningSummary: settings.notifications.eveningSummary,
    },
    setupDisposition: settings.setup.disposition,
    currentStep: Math.min(6, settings.setup.currentStep),
  };
}
