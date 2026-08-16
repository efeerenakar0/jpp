import 'server-only';

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getDeedProcessGuide } from '@/components/fabrika/deed-tracking/process-catalog';
import {
  DEED_APPLICATION_STATUSES,
  DEED_PAYMENT_STATUSES,
  EMPTY_DEED_WORKFLOW,
  normalizeDeedWorkflow,
} from '@/lib/deed-workflow';

import {
  buildDeedChecklist,
  canTransitionDeedCase,
  reconcileDeedChecklist,
  type DeedCaseStatus,
} from './deed-tracking';

type PrincipalRef = { type: 'OWNER' | 'EMPLOYEE'; id: string };

export class DeedTrackingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'CONFLICT'
  ) {
    super(message);
    this.name = 'DeedTrackingError';
  }
}

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();

export const deedChecklistItemSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(240),
    required: z.boolean(),
    completed: z.boolean(),
  })
  .strict();

export const createDeedCaseSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    type: z.enum([
      'SALE',
      'PURCHASE',
      'MORTGAGE',
      'INHERITANCE',
      'CORRECTION',
      'OTHER',
    ]),
    guideId: z.string().trim().min(1).max(80).nullable().optional(),
    propertyId: z.string().min(1).nullable().optional(),
    contactId: z.string().min(1).nullable().optional(),
    assignedMemberId: z.string().min(1).nullable().optional(),
    appointmentAt: optionalDate,
    dueAt: optionalDate,
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export const deedWorkflowSchema = z
  .object({
    identityVerified: z.boolean(),
    authorityVerified: z.boolean(),
    titleRecordVerified: z.boolean(),
    encumbranceVerified: z.boolean(),
    daskVerified: z.boolean(),
    municipalValueVerified: z.boolean(),
    paymentPlanVerified: z.boolean(),
    applicationNumber: z.string().trim().max(80),
    applicationStatus: z.enum(DEED_APPLICATION_STATUSES),
    eCollectionNumber: z.string().trim().max(32),
    deedFeeStatus: z.enum(DEED_PAYMENT_STATUSES),
    revolvingFundStatus: z.enum(DEED_PAYMENT_STATUSES),
    declaredValue: z.string().trim().max(40),
    municipalValue: z.string().trim().max(40),
    daskPolicyNumber: z.string().trim().max(80),
    daskExpiresAt: z.string().trim().max(16),
    paymentOwner: z.string().trim().max(160),
    securePaymentReference: z.string().trim().max(80),
    securePaymentStatus: z.enum(DEED_PAYMENT_STATUSES),
    appointmentConfirmed: z.boolean(),
    signaturesCompleted: z.boolean(),
    registrationVerified: z.boolean(),
    deedDocumentReceived: z.boolean(),
    keyDelivered: z.boolean(),
    clientInformed: z.boolean(),
    originalsReturned: z.boolean(),
  })
  .strict();

export const updateDeedCaseSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    status: z
      .enum([
        'DRAFT',
        'PREPARING',
        'DOCUMENTS_MISSING',
        'READY_FOR_APPOINTMENT',
        'APPOINTMENT_SCHEDULED',
        'COMPLETED',
        'CANCELLED',
      ])
      .optional(),
    checklist: z.array(deedChecklistItemSchema).min(1).max(40).optional(),
    workflow: deedWorkflowSchema.optional(),
    assignedMemberId: z.string().min(1).nullable().optional(),
    appointmentAt: optionalDate,
    dueAt: optionalDate,
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

const storedChecklistSchema = z.array(deedChecklistItemSchema).min(1).max(40);

function dateValue(value: string | null | undefined) {
  return value ? new Date(value) : value === null ? null : undefined;
}

async function validateTenantReferences(
  tx: Prisma.TransactionClient,
  companyAccountId: string,
  input: {
    propertyId?: string | null;
    contactId?: string | null;
    assignedMemberId?: string | null;
  }
) {
  const [property, contact, member] = await Promise.all([
    input.propertyId
      ? tx.crmProperty.findFirst({
          where: { id: input.propertyId, companyAccountId },
          select: { id: true },
        })
      : null,
    input.contactId
      ? tx.crmContact.findFirst({
          where: { id: input.contactId, companyAccountId },
          select: { id: true },
        })
      : null,
    input.assignedMemberId
      ? tx.companyMember.findFirst({
          where: { id: input.assignedMemberId, companyAccountId, active: true },
          select: { id: true },
        })
      : null,
  ]);

  if (input.propertyId && !property) {
    throw new DeedTrackingError('Seçilen portföy bu şirkete ait değil.', 'FORBIDDEN');
  }
  if (input.contactId && !contact) {
    throw new DeedTrackingError('Seçilen müşteri bu şirkete ait değil.', 'FORBIDDEN');
  }
  if (input.assignedMemberId && !member) {
    throw new DeedTrackingError('Seçilen çalışan bu şirkette aktif değil.', 'FORBIDDEN');
  }
}

export async function listDeedTrackingCases(input: {
  companyAccountId: string;
  assignedMemberId?: string;
}) {
  return prisma.deedTrackingCase.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      ...(input.assignedMemberId
        ? { assignedMemberId: input.assignedMemberId }
        : {}),
    },
    include: {
      property: {
        select: { id: true, title: true, referenceCode: true, location: true },
      },
      contact: { select: { id: true, name: true } },
      assignedMember: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  });
}

export async function createDeedTrackingCase(input: {
  companyAccountId: string;
  data: z.infer<typeof createDeedCaseSchema>;
  principal: PrincipalRef;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    await validateTenantReferences(tx, input.companyAccountId, input.data);
    const guide = input.data.guideId
      ? getDeedProcessGuide(input.data.guideId)
      : null;
    if (input.data.guideId && (!guide || guide.caseType !== input.data.type)) {
      throw new DeedTrackingError(
        'Seçilen işlem rehberi bu tapu dosyasıyla eşleşmiyor.',
        'INVALID_STATE'
      );
    }
    const checklist = buildDeedChecklist(input.data.type, input.data.guideId);
    const deedCase = await tx.deedTrackingCase.create({
      data: {
        companyAccountId: input.companyAccountId,
        propertyId: input.data.propertyId || null,
        contactId: input.data.contactId || null,
        assignedMemberId: input.data.assignedMemberId || null,
        type: input.data.type,
        title: input.data.title,
        guideId: input.data.guideId || null,
        checklist: checklist as unknown as Prisma.InputJsonValue,
        workflow: EMPTY_DEED_WORKFLOW as unknown as Prisma.InputJsonValue,
        appointmentAt: dateValue(input.data.appointmentAt),
        dueAt: dateValue(input.data.dueAt),
        notes: input.data.notes || null,
        officialIntegration: 'NOT_CONNECTED',
        humanApprovalRequired: true,
        createdByPrincipalType: input.principal.type,
        createdByPrincipalId: input.principal.id,
      } as never,
    });
    await tx.deedTrackingEvent.create({
      data: {
        companyAccountId: input.companyAccountId,
        deedTrackingCaseId: deedCase.id,
        eventType: 'CASE_CREATED',
        message: 'Tapu takip dosyası oluşturuldu.',
        metadata: { type: input.data.type },
        actorPrincipalType: input.principal.type,
        actorPrincipalId: input.principal.id,
        createdAt: input.now,
      },
    });
    return deedCase;
  });
}

export async function updateDeedTrackingCase(input: {
  companyAccountId: string;
  accessibleMemberId?: string;
  data: z.infer<typeof updateDeedCaseSchema>;
  principal: PrincipalRef;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deedTrackingCase.findFirst({
      where: {
        id: input.data.id,
        companyAccountId: input.companyAccountId,
        ...(input.accessibleMemberId
          ? { assignedMemberId: input.accessibleMemberId }
          : {}),
      },
    });
    if (!existing) throw new DeedTrackingError('Tapu takip dosyası bulunamadı.', 'NOT_FOUND');
    const persisted = existing as typeof existing & {
      guideId: string | null;
      workflow: unknown;
    };
    if (existing.version !== input.data.version) {
      throw new DeedTrackingError(
        'Kayıt başka bir kullanıcı tarafından güncellendi. Lütfen yenileyin.',
        'CONFLICT'
      );
    }

    await validateTenantReferences(tx, input.companyAccountId, {
      assignedMemberId: input.data.assignedMemberId,
    });

    const previousChecklist = storedChecklistSchema.parse(existing.checklist);
    const checklist = input.data.checklist
      ? reconcileDeedChecklist(
          existing.type,
          input.data.checklist,
          persisted.guideId
        )
      : previousChecklist;
    if (!checklist) {
      throw new DeedTrackingError(
        'Belge kontrol listesinin anahtarları veya zorunlulukları değiştirilemez.',
        'INVALID_STATE'
      );
    }
    const workflow = input.data.workflow
      ? deedWorkflowSchema.parse(input.data.workflow)
      : normalizeDeedWorkflow(persisted.workflow);
    const nextStatus = (input.data.status || existing.status) as DeedCaseStatus;
    if (nextStatus !== existing.status) {
      const transition = canTransitionDeedCase({
        from: existing.status as DeedCaseStatus,
        to: nextStatus,
        checklist,
        type: existing.type,
        workflow,
      });
      if (!transition.allowed) {
        throw new DeedTrackingError(
          transition.reason === 'REQUIRED_DOCUMENTS_MISSING'
            ? 'Zorunlu belgeler tamamlanmadan bu aşamaya geçilemez.'
            : transition.reason === 'REQUIRED_CONTROLS_MISSING'
              ? 'Kimlik, yetki, tapu ve işleme özel kontroller tamamlanmadan bu aşamaya geçilemez.'
              : transition.reason === 'CLOSING_CHECKS_MISSING'
                ? 'Tescil, belge teslimi ve müşteri bilgilendirmesi tamamlanmadan dosya kapatılamaz.'
                : 'Bu durum geçişine izin verilmiyor.',
          'INVALID_STATE'
        );
      }
    }

    const updateResult = await tx.deedTrackingCase.updateMany({
      where: {
        id: existing.id,
        companyAccountId: input.companyAccountId,
        version: input.data.version,
      },
      data: {
        ...(input.data.status ? { status: nextStatus } : {}),
        ...(input.data.checklist
          ? { checklist: checklist as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.data.workflow
          ? {
              workflow: workflow as unknown as Prisma.InputJsonValue,
              officialReference: workflow.applicationNumber || null,
            }
          : {}),
        ...(input.data.assignedMemberId !== undefined
          ? { assignedMemberId: input.data.assignedMemberId }
          : {}),
        ...(input.data.appointmentAt !== undefined
          ? { appointmentAt: dateValue(input.data.appointmentAt) }
          : {}),
        ...(input.data.dueAt !== undefined
          ? { dueAt: dateValue(input.data.dueAt) }
          : {}),
        ...(input.data.notes !== undefined ? { notes: input.data.notes } : {}),
        completedAt: nextStatus === 'COMPLETED' ? input.now : existing.completedAt,
        cancelledAt: nextStatus === 'CANCELLED' ? input.now : existing.cancelledAt,
        version: { increment: 1 },
      } as never,
    });
    if (updateResult.count !== 1) {
      throw new DeedTrackingError(
        'Kayıt aynı anda değiştirildi. Lütfen yenileyin.',
        'CONFLICT'
      );
    }

    await tx.deedTrackingEvent.create({
      data: {
        companyAccountId: input.companyAccountId,
        deedTrackingCaseId: existing.id,
        eventType:
          nextStatus !== existing.status ? 'STATUS_CHANGED' : 'CASE_UPDATED',
        message:
          nextStatus !== existing.status
            ? `Süreç durumu ${nextStatus} olarak güncellendi.`
            : 'Tapu takip bilgileri güncellendi.',
        metadata: {
          previousStatus: existing.status,
          nextStatus,
          version: input.data.version + 1,
        },
        actorPrincipalType: input.principal.type,
        actorPrincipalId: input.principal.id,
        createdAt: input.now,
      },
    });

    return tx.deedTrackingCase.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        property: { select: { id: true, title: true, referenceCode: true } },
        contact: { select: { id: true, name: true } },
        assignedMember: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
  });
}
