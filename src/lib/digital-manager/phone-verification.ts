import {
  randomInt,
  randomUUID,
} from 'node:crypto';
import { Prisma } from '@prisma/client';

import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';
import { prisma } from '@/lib/prisma';

import { normalizeE164 } from './domain';
import {
  createPhoneVerificationCodeHash,
  phoneVerificationCodeMatches,
} from './phone-verification-code';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export type PhoneVerificationSubject = 'OWNER' | 'MEMBER';

export class PhoneVerificationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 | 429 | 503 = 400
  ) {
    super(message);
    this.name = 'PhoneVerificationError';
  }
}

function verificationSecret() {
  const secret =
    process.env.PHONE_VERIFICATION_SECRET?.trim() ||
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) {
    throw new PhoneVerificationError(
      'Telefon doğrulama güvenlik anahtarı yapılandırılmamış.',
      503
    );
  }
  return secret;
}

async function subjectPhone(input: {
  companyAccountId: string;
  subjectType: PhoneVerificationSubject;
  subjectId: string;
}) {
  const [account, preference, members] = await Promise.all([
    prisma.companyAccount.findUnique({
      where: { id: input.companyAccountId },
      select: {
        id: true,
        ownerPhone: true,
        ownerPhoneNormalized: true,
        whatsAppConfig: { select: { connectedPhone: true } },
      },
    }),
    prisma.managerNotificationPreference.findUnique({
      where: { companyAccountId: input.companyAccountId },
      select: {
        ownerPhone: true,
        ownerPhoneNormalized: true,
      },
    }),
    prisma.companyMember.findMany({
      where: {
        companyAccountId: input.companyAccountId,
        active: true,
      },
      select: {
        id: true,
        phone: true,
        phoneNormalized: true,
      },
    }),
  ]);
  if (!account) {
    throw new PhoneVerificationError('Şirket hesabı bulunamadı.', 404);
  }

  const member =
    input.subjectType === 'MEMBER'
      ? members.find((candidate) => candidate.id === input.subjectId)
      : null;
  if (input.subjectType === 'MEMBER' && !member) {
    throw new PhoneVerificationError('Çalışan bulunamadı.', 404);
  }
  if (
    input.subjectType === 'OWNER' &&
    input.subjectId !== input.companyAccountId
  ) {
    throw new PhoneVerificationError(
      'Patron doğrulama hedefi geçersiz.',
      400
    );
  }

  const rawPhone =
    input.subjectType === 'OWNER'
      ? preference?.ownerPhone ||
        account.ownerPhone ||
        preference?.ownerPhoneNormalized ||
        account.ownerPhoneNormalized
      : member?.phone || member?.phoneNormalized;
  const phoneNormalized = normalizeE164(rawPhone);
  if (!phoneNormalized) {
    throw new PhoneVerificationError(
      'Önce ülke koduyla geçerli bir telefon kaydedin.'
    );
  }

  const connectedPhone = normalizeE164(
    account.whatsAppConfig?.connectedPhone
  );
  if (connectedPhone && connectedPhone === phoneNormalized) {
    throw new PhoneVerificationError(
      'Doğrulanan kişisel telefon bağlı işletme numarasıyla aynı olamaz.',
      409
    );
  }

  const conflictingMember = members.find(
    (candidate) =>
      candidate.id !==
        (input.subjectType === 'MEMBER' ? input.subjectId : '') &&
      normalizeE164(candidate.phoneNormalized || candidate.phone) ===
        phoneNormalized
  );
  if (conflictingMember) {
    throw new PhoneVerificationError(
      'Bu telefon başka bir aktif çalışana kayıtlı.',
      409
    );
  }

  const ownerPhone = normalizeE164(
    preference?.ownerPhoneNormalized ||
      preference?.ownerPhone ||
      account.ownerPhoneNormalized ||
      account.ownerPhone
  );
  if (
    input.subjectType === 'MEMBER' &&
    ownerPhone &&
    ownerPhone === phoneNormalized
  ) {
    throw new PhoneVerificationError(
      'Çalışan telefonu patronun komut numarasıyla aynı olamaz.',
      409
    );
  }

  return { phoneNormalized };
}

export async function requestPhoneVerification(input: {
  companyAccountId: string;
  subjectType: PhoneVerificationSubject;
  subjectId: string;
  createdByType: string;
  createdById?: string | null;
}) {
  const { phoneNormalized } = await subjectPhone(input);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const latest = await prisma.phoneVerificationChallenge.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (
    latest &&
    latest.createdAt.getTime() >
      now.getTime() - RESEND_COOLDOWN_MS
  ) {
    throw new PhoneVerificationError(
      'Yeni kod istemeden önce 60 saniye bekleyin.',
      429
    );
  }
  const recentCount = await prisma.phoneVerificationChallenge.count({
    where: {
      companyAccountId: input.companyAccountId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      createdAt: { gte: hourAgo },
    },
  });
  if (recentCount >= MAX_REQUESTS_PER_HOUR) {
    throw new PhoneVerificationError(
      'Saatlik doğrulama kodu sınırına ulaşıldı.',
      429
    );
  }

  const challengeId = randomUUID();
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const codeHash = createPhoneVerificationCodeHash({
    challengeId,
    phoneNormalized,
    code,
    secret: verificationSecret(),
  });

  await prisma.$transaction(async (tx) => {
    await tx.phoneVerificationChallenge.updateMany({
      where: {
        companyAccountId: input.companyAccountId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        consumedAt: null,
      },
      data: { consumedAt: now },
    });
    await tx.phoneVerificationChallenge.create({
      data: {
        id: challengeId,
        companyAccountId: input.companyAccountId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        phoneNormalized,
        codeHash,
        expiresAt,
        maxAttempts: MAX_ATTEMPTS,
        createdByType: input.createdByType,
        createdById: input.createdById,
      },
    });
  });

  try {
    const delivery = await queueCompanyWhatsAppMessage({
      companyAccountId: input.companyAccountId,
      to: phoneNormalized,
      text: `Jasmine AI telefon doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.`,
      recipientType:
        input.subjectType === 'OWNER' ? 'OWNER' : 'EMPLOYEE',
      recipientId: input.subjectId,
      purpose: 'PHONE_VERIFICATION',
      correlationId: challengeId,
      idempotencyKey: `phone-verification:${challengeId}`,
      createdByType: input.createdByType,
      createdById: input.createdById || undefined,
    });
    if (delivery.deliveryStatus === 'FAILED') {
      throw new Error(
        delivery.lastError ||
          'WhatsApp sağlayıcısı doğrulama kodunu kabul etmedi.'
      );
    }
    await prisma.phoneVerificationChallenge.update({
      where: { id: challengeId },
      data: { sentAt: new Date() },
    });
    return {
      challengeId,
      expiresAt,
      deliveryStatus: delivery.deliveryStatus,
    };
  } catch (error) {
    await prisma.phoneVerificationChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    throw new PhoneVerificationError(
      error instanceof Error
        ? `Doğrulama kodu gönderilemedi: ${error.message}`
        : 'Doğrulama kodu gönderilemedi.',
      503
    );
  }
}

export async function confirmPhoneVerification(input: {
  companyAccountId: string;
  challengeId: string;
  code: string;
  actorType: string;
  actorId?: string | null;
}) {
  const challenge =
    await prisma.phoneVerificationChallenge.findFirst({
      where: {
        id: input.challengeId,
        companyAccountId: input.companyAccountId,
      },
    });
  if (!challenge) {
    throw new PhoneVerificationError(
      'Doğrulama isteği bulunamadı.',
      404
    );
  }
  const now = new Date();
  if (challenge.consumedAt) {
    throw new PhoneVerificationError(
      'Bu doğrulama kodu daha önce kullanılmış.',
      409
    );
  }
  if (challenge.expiresAt <= now) {
    await prisma.phoneVerificationChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: now },
    });
    throw new PhoneVerificationError(
      'Doğrulama kodunun süresi doldu.',
      409
    );
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new PhoneVerificationError(
      'Doğrulama deneme sınırı aşıldı.',
      429
    );
  }

  const matches = phoneVerificationCodeMatches({
    challengeId: challenge.id,
    phoneNormalized: challenge.phoneNormalized,
    code: input.code,
    expectedHash: challenge.codeHash,
    secret: verificationSecret(),
  });
  if (!matches) {
    const attempts = challenge.attempts + 1;
    await prisma.phoneVerificationChallenge.updateMany({
      where: {
        id: challenge.id,
        companyAccountId: input.companyAccountId,
        consumedAt: null,
        attempts: challenge.attempts,
      },
      data: {
        attempts,
        consumedAt:
          attempts >= challenge.maxAttempts ? now : undefined,
      },
    });
    throw new PhoneVerificationError(
      attempts >= challenge.maxAttempts
        ? 'Kod yanlış; deneme sınırı aşıldı.'
        : 'Doğrulama kodu yanlış.',
      attempts >= challenge.maxAttempts ? 429 : 400
    );
  }

  const current = await subjectPhone({
    companyAccountId: input.companyAccountId,
    subjectType:
      challenge.subjectType as PhoneVerificationSubject,
    subjectId: challenge.subjectId,
  });
  if (current.phoneNormalized !== challenge.phoneNormalized) {
    throw new PhoneVerificationError(
      'Telefon değiştiği için yeni bir doğrulama kodu isteyin.',
      409
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const consumed =
        await tx.phoneVerificationChallenge.updateMany({
          where: {
            id: challenge.id,
            companyAccountId: input.companyAccountId,
            consumedAt: null,
            attempts: challenge.attempts,
          },
          data: { consumedAt: now },
        });
      if (consumed.count !== 1) {
        throw new PhoneVerificationError(
          'Doğrulama kodu başka bir işlem tarafından kullanıldı.',
          409
        );
      }

      if (challenge.subjectType === 'OWNER') {
        await tx.companyAccount.update({
          where: { id: input.companyAccountId },
          data: {
            ownerPhone: challenge.phoneNormalized,
            ownerPhoneNormalized: challenge.phoneNormalized,
            ownerPhoneVerificationStatus: 'VERIFIED',
            ownerPhoneVerifiedAt: now,
          },
        });
        await tx.managerNotificationPreference.upsert({
          where: { companyAccountId: input.companyAccountId },
          update: {
            ownerPhone: challenge.phoneNormalized,
            ownerPhoneNormalized: challenge.phoneNormalized,
            ownerPhoneVerificationStatus: 'VERIFIED',
            ownerPhoneVerifiedAt: now,
          },
          create: {
            companyAccountId: input.companyAccountId,
            ownerPhone: challenge.phoneNormalized,
            ownerPhoneNormalized: challenge.phoneNormalized,
            ownerPhoneVerificationStatus: 'VERIFIED',
            ownerPhoneVerifiedAt: now,
          },
        });
      } else {
        const updated = await tx.companyMember.updateMany({
          where: {
            id: challenge.subjectId,
            companyAccountId: input.companyAccountId,
            active: true,
            phoneNormalized: challenge.phoneNormalized,
          },
          data: {
            phoneVerificationStatus: 'VERIFIED',
            phoneVerifiedAt: now,
          },
        });
        if (updated.count !== 1) {
          throw new PhoneVerificationError(
            'Çalışanın telefonu değişti; yeni kod isteyin.',
            409
          );
        }
      }

      await tx.managerAuditLog.create({
        data: {
          companyAccountId: input.companyAccountId,
          actorType: input.actorType,
          actorId: input.actorId,
          operation: 'VERIFY_PHONE_OWNERSHIP',
          entityType:
            challenge.subjectType === 'OWNER'
              ? 'COMPANY_ACCOUNT'
              : 'COMPANY_MEMBER',
          entityId: challenge.subjectId,
          evidence: {
            challengeId: challenge.id,
            phoneLast4: challenge.phoneNormalized.slice(-4),
          } satisfies Prisma.InputJsonValue,
          result: 'VERIFIED',
          completedAt: now,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    verified: true,
    subjectType: challenge.subjectType,
    subjectId: challenge.subjectId,
    phoneNormalized: challenge.phoneNormalized,
  };
}
