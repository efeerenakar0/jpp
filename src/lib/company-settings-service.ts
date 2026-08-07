import 'server-only';

import type { Prisma } from '@prisma/client';

import {
  companySettingsRequestSchema,
  nextDataProcessingTimeline,
  normalizeCompanySettings,
  toLegacyOnboardingProfile,
  validateEscalationMembers,
  type CompanySettingsMemberOption,
  type CompanySettingsRequest,
} from './company-settings';
import { managerPreferencesFromOnboarding } from './company-onboarding';
import { normalizeE164 } from './digital-manager/domain';
import prisma from './prisma';

export class CompanySettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanySettingsValidationError';
  }
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function memberOptions(
  members: Array<{
    id: string;
    name: string;
    role: CompanySettingsMemberOption['role'];
    phone: string | null;
    phoneVerificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'CONFLICT';
    canReceiveWhatsAppTasks: boolean;
  }>
): CompanySettingsMemberOption[] {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    phone: member.phone,
    phoneVerified: member.phoneVerificationStatus === 'VERIFIED',
    canReceiveWhatsAppTasks: member.canReceiveWhatsAppTasks,
  }));
}

export async function getCompanySettings(companyAccountId: string) {
  const [account, settings, members] = await Promise.all([
    prisma.companyAccount.findUniqueOrThrow({
      where: { id: companyAccountId },
      select: {
        companyName: true,
        brandLogoData: true,
        ownerEmail: true,
        ownerPhone: true,
        timezone: true,
        onboardingState: true,
        onboardingCompletedAt: true,
      },
    }),
    prisma.companySettings.findUnique({
      where: { companyAccountId },
      include: {
        escalationSteps: {
          orderBy: { priority: 'asc' },
          select: { memberId: true },
        },
      },
    }),
    prisma.companyMember.findMany({
      where: { companyAccountId, active: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        phoneVerificationStatus: true,
        canReceiveWhatsAppTasks: true,
      },
    }),
  ]);

  const normalized = normalizeCompanySettings({
    account,
    persisted: settings,
    escalationMemberIds:
      settings?.escalationSteps.map((step) => step.memberId) ?? [],
  });

  return {
    settings: normalized,
    completed: Boolean(account.onboardingCompletedAt),
    completedAt: account.onboardingCompletedAt,
    members: memberOptions(members),
  };
}

export async function saveCompanySettings(
  companyAccountId: string,
  input: CompanySettingsRequest,
  now = new Date()
) {
  const settings = companySettingsRequestSchema.parse(input);
  const contactPhoneNormalized = settings.company.contactPhone
    ? normalizeE164(settings.company.contactPhone)
    : null;

  if (settings.company.contactPhone && !contactPhoneNormalized) {
    throw new CompanySettingsValidationError(
      'İletişim telefonunu ülke koduyla girin (ör. +905551112233).'
    );
  }

  await prisma.$transaction(async (tx) => {
    const [account, existingSettings, escalationMembers] = await Promise.all([
      tx.companyAccount.findUniqueOrThrow({
        where: { id: companyAccountId },
        select: {
          onboardingState: true,
          onboardingCompletedAt: true,
          ownerPhoneNormalized: true,
        },
      }),
      tx.companySettings.findUnique({
        where: { companyAccountId },
        select: {
          id: true,
          dataProcessingAccepted: true,
          dataProcessingAcceptedAt: true,
          dataProcessingRevokedAt: true,
        },
      }),
      tx.companyMember.findMany({
        where: { id: { in: settings.escalationMemberIds } },
        select: {
          id: true,
          companyAccountId: true,
          active: true,
          canReceiveWhatsAppTasks: true,
        },
      }),
    ]);

    try {
      validateEscalationMembers(
        settings.escalationMemberIds,
        escalationMembers,
        companyAccountId
      );
    } catch (error) {
      throw new CompanySettingsValidationError(
        error instanceof Error ? error.message : 'Eskalasyon sırası geçersiz.'
      );
    }

    const legacyProfile = toLegacyOnboardingProfile(
      settings,
      account.onboardingState
    );
    const completed = settings.setup.disposition === 'COMPLETED';
    if (
      completed &&
      !settings.dataProcessing.accepted &&
      !account.onboardingCompletedAt
    ) {
      throw new CompanySettingsValidationError(
        'Kurulumu tamamlamak için veri işleme bilgilendirmesini onaylayın.'
      );
    }
    const consentTimeline = nextDataProcessingTimeline({
      wasAccepted: Boolean(existingSettings?.dataProcessingAccepted),
      acceptedAt: existingSettings?.dataProcessingAcceptedAt ?? null,
      revokedAt: existingSettings?.dataProcessingRevokedAt ?? null,
      accepted: settings.dataProcessing.accepted,
      now,
    });

    const savedSettings = await tx.companySettings.upsert({
      where: { companyAccountId },
      create: {
        companyAccountId,
        address: nullable(settings.company.address),
        city: nullable(settings.company.city),
        district: nullable(settings.company.district),
        latitude: settings.company.latitude,
        longitude: settings.company.longitude,
        contactEmail: nullable(settings.company.contactEmail),
        contactPhone: nullable(settings.company.contactPhone),
        contactPhoneNormalized,
        locale: settings.company.locale,
        websiteStatus: settings.website.status,
        websiteUrl: nullable(settings.website.url),
        hostingProvider: nullable(settings.website.hostingProvider),
        instagramUrl: nullable(settings.socialLinks.instagram),
        facebookUrl: nullable(settings.socialLinks.facebook),
        tiktokUrl: nullable(settings.socialLinks.tiktok),
        xUrl: nullable(settings.socialLinks.x),
        linkedinUrl: nullable(settings.socialLinks.linkedin),
        workHours: settings.workHours as Prisma.InputJsonValue,
        ...settings.operations,
        ownerNotifications: settings.notifications as Prisma.InputJsonValue,
        aiAutomationPermissions:
          settings.aiPermissions as Prisma.InputJsonValue,
        dataProcessingAccepted: settings.dataProcessing.accepted,
        dataProcessingAcceptedAt: settings.dataProcessing.accepted ? now : null,
        dataProcessingConsentVersion: settings.dataProcessing.accepted
          ? settings.dataProcessing.consentVersion
          : null,
        setupDisposition: settings.setup.disposition,
        setupCurrentStep: settings.setup.currentStep,
        setupDeferredAt:
          settings.setup.disposition === 'DEFERRED' ? now : null,
      },
      update: {
        address: nullable(settings.company.address),
        city: nullable(settings.company.city),
        district: nullable(settings.company.district),
        latitude: settings.company.latitude,
        longitude: settings.company.longitude,
        contactEmail: nullable(settings.company.contactEmail),
        contactPhone: nullable(settings.company.contactPhone),
        contactPhoneNormalized,
        locale: settings.company.locale,
        websiteStatus: settings.website.status,
        websiteUrl: nullable(settings.website.url),
        hostingProvider: nullable(settings.website.hostingProvider),
        instagramUrl: nullable(settings.socialLinks.instagram),
        facebookUrl: nullable(settings.socialLinks.facebook),
        tiktokUrl: nullable(settings.socialLinks.tiktok),
        xUrl: nullable(settings.socialLinks.x),
        linkedinUrl: nullable(settings.socialLinks.linkedin),
        workHours: settings.workHours as Prisma.InputJsonValue,
        ...settings.operations,
        ownerNotifications: settings.notifications as Prisma.InputJsonValue,
        aiAutomationPermissions:
          settings.aiPermissions as Prisma.InputJsonValue,
        dataProcessingAccepted: settings.dataProcessing.accepted,
        dataProcessingAcceptedAt: consentTimeline.acceptedAt,
        dataProcessingRevokedAt: consentTimeline.revokedAt,
        dataProcessingConsentVersion: settings.dataProcessing.accepted
          ? settings.dataProcessing.consentVersion
          : null,
        setupDisposition: settings.setup.disposition,
        setupCurrentStep: settings.setup.currentStep,
        setupDeferredAt:
          settings.setup.disposition === 'DEFERRED' ? now : null,
      },
      select: { id: true },
    });

    await tx.companyEscalationStep.deleteMany({
      where: { companyAccountId },
    });
    if (settings.escalationMemberIds.length > 0) {
      await tx.companyEscalationStep.createMany({
        data: settings.escalationMemberIds.map((memberId, index) => ({
          companyAccountId,
          settingsId: savedSettings.id,
          memberId,
          priority: index + 1,
        })),
      });
    }

    const phoneChanged = account.ownerPhoneNormalized !== contactPhoneNormalized;
    const managerPreferences = managerPreferencesFromOnboarding(legacyProfile);

    await tx.companyAccount.update({
      where: { id: companyAccountId },
      data: {
        companyName: settings.company.name,
        brandLogoData: settings.company.logoData || null,
        ownerPhone: nullable(settings.company.contactPhone),
        ownerPhoneNormalized: contactPhoneNormalized,
        timezone: settings.company.timezone,
        onboardingState: legacyProfile as Prisma.InputJsonValue,
        onboardingCompletedAt: completed
          ? account.onboardingCompletedAt ?? now
          : null,
      },
    });

    await tx.managerNotificationPreference.upsert({
      where: { companyAccountId },
      create: {
        companyAccountId,
        ...managerPreferences,
        ownerPhoneNormalized: contactPhoneNormalized,
        notifyCriticalImmediately: settings.notifications.criticalImmediately,
      },
      update: {
        ...managerPreferences,
        ownerPhoneNormalized: contactPhoneNormalized,
        notifyCriticalImmediately: settings.notifications.criticalImmediately,
        ...(phoneChanged
          ? {
              ownerPhoneVerificationStatus: 'UNVERIFIED' as const,
              ownerPhoneVerifiedAt: null,
            }
          : {}),
      },
    });
  });

  return getCompanySettings(companyAccountId);
}
