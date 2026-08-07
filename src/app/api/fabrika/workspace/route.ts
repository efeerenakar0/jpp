import { NextResponse } from 'next/server';
import {
  ConsentStatus,
  CrmContactStage,
  CrmContactType,
  CrmDealStage,
  CrmPropertyStatus,
  CrmTaskStatus,
  CrmTaskType,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { syncLegacyModulesToWorkspace } from '@/lib/fabrika-workspace-sync';
import {
  CompanyMemberValidationError,
  companyMemberOperationalFieldsSchema,
  createCompanyMemberAccount,
  resetCompanyMemberCredentials,
  setCompanyMemberActive,
  updateCompanyMemberProfile,
  type OneTimeMemberCredentials,
} from '@/lib/company-members';
import { calculateCrmScore } from '@/lib/crm-intelligence';

const optionalText = z.string().trim().max(500).optional().nullable();
const optionalId = z.string().trim().min(1).optional().nullable();
const optionalNumber = z.coerce.number().finite().nonnegative().optional().nullable();

class WorkspaceActionError extends Error {
  constructor(
    message: string,
    readonly statusCode = 409
  ) {
    super(message);
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create-contact'),
    name: z.string().trim().min(2).max(120),
    phone: optionalText,
    email: z.string().trim().email().optional().or(z.literal('')),
    type: z.nativeEnum(CrmContactType).default(CrmContactType.BUYER),
    stage: z.nativeEnum(CrmContactStage).default(CrmContactStage.NEW),
    source: optionalText,
    desiredLocation: optionalText,
    desiredRoomCount: optionalText,
    budgetMin: optionalNumber,
    budgetMax: optionalNumber,
    notes: z.string().trim().max(5000).optional().nullable(),
    consentStatus: z.nativeEnum(ConsentStatus).default(ConsentStatus.UNKNOWN),
    assignedMemberId: optionalId,
  }),
  z.object({
    action: z.literal('update-contact'),
    id: z.string().trim().min(1),
    name: z.string().trim().min(2).max(120),
    phone: optionalText,
    email: z.string().trim().email().optional().or(z.literal('')),
    type: z.nativeEnum(CrmContactType),
    stage: z.nativeEnum(CrmContactStage),
    source: optionalText,
    desiredLocation: optionalText,
    desiredRoomCount: optionalText,
    budgetMin: optionalNumber,
    budgetMax: optionalNumber,
    notes: z.string().trim().max(5000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    consentStatus: z.nativeEnum(ConsentStatus),
    nextActionAt: z.string().datetime().optional().nullable(),
    assignedMemberId: optionalId,
  }),
  z.object({
    action: z.literal('add-contact-note'),
    id: z.string().trim().min(1),
    note: z.string().trim().min(2).max(5000),
  }),
  z.object({
    action: z.literal('score-contact'),
    id: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('merge-contacts'),
    primaryId: z.string().trim().min(1),
    duplicateId: z.string().trim().min(1),
  }).refine((value) => value.primaryId !== value.duplicateId, {
    message: 'Birleştirilecek kayıtlar farklı olmalıdır.',
  }),
  z.object({
    action: z.literal('create-property'),
    title: z.string().trim().min(3).max(180),
    referenceCode: optionalText,
    location: optionalText,
    price: optionalNumber,
    roomCount: optionalText,
    area: optionalNumber,
    status: z.nativeEnum(CrmPropertyStatus).default(CrmPropertyStatus.DRAFT),
    description: z.string().trim().max(10000).optional().nullable(),
    imageUrl: z.string().trim().url().optional().or(z.literal('')),
    ownerContactId: optionalId,
    assignedMemberId: optionalId,
  }),
  z.object({
    action: z.literal('update-property'),
    id: z.string().trim().min(1),
    title: z.string().trim().min(3).max(180),
    referenceCode: optionalText,
    location: optionalText,
    price: optionalNumber,
    roomCount: optionalText,
    area: optionalNumber,
    status: z.nativeEnum(CrmPropertyStatus),
    description: z.string().trim().max(10000).optional().nullable(),
    imageUrl: z.string().trim().url().optional().or(z.literal('')),
    ownerContactId: optionalId,
    assignedMemberId: optionalId,
  }),
  z.object({
    action: z.literal('set-property-status'),
    id: z.string().trim().min(1),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    idempotencyKey: z.string().trim().min(8).max(160),
  }),
  z.object({
    action: z.literal('approve-property-publication'),
    id: z.string().trim().min(1),
    authorizationDocumentId: z.string().trim().min(1),
    authorityExpiresAt: z.string().datetime().optional().nullable(),
    eidsRequired: z.boolean().default(true),
    eidsVerificationReference: z.string().trim().max(240).optional().nullable(),
    eidsExemptionReason: z.string().trim().max(1000).optional().nullable(),
    idempotencyKey: z.string().trim().min(8).max(160),
  }).superRefine((value, context) => {
    if (value.eidsRequired && !value.eidsVerificationReference) {
      context.addIssue({ code: 'custom', path: ['eidsVerificationReference'], message: 'EİDS doğrulama referansı gerekli.' });
    }
    if (!value.eidsRequired && !value.eidsExemptionReason) {
      context.addIssue({ code: 'custom', path: ['eidsExemptionReason'], message: 'EİDS muafiyet gerekçesi gerekli.' });
    }
  }),
  z.object({
    action: z.literal('create-deal'),
    title: z.string().trim().min(3).max(180),
    contactId: z.string().trim().min(1),
    propertyId: optionalId,
    assignedMemberId: optionalId,
    estimatedValue: optionalNumber,
    commissionRate: z.coerce.number().min(0).max(100).optional().nullable(),
    nextAction: optionalText,
  }),
  z.object({
    action: z.literal('move-deal'),
    id: z.string().trim().min(1),
    stage: z.nativeEnum(CrmDealStage),
  }),
  z.object({
    action: z.literal('create-task'),
    title: z.string().trim().min(3).max(180),
    type: z.nativeEnum(CrmTaskType).default(CrmTaskType.FOLLOW_UP),
    description: z.string().trim().max(5000).optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    priority: z.coerce.number().int().min(1).max(3).default(2),
    contactId: optionalId,
    propertyId: optionalId,
    dealId: optionalId,
    assignedMemberId: optionalId,
  }),
  z.object({
    action: z.literal('toggle-task'),
    id: z.string().trim().min(1),
    completed: z.boolean(),
  }),
  z
    .object({
      action: z.literal('create-member'),
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().optional().or(z.literal('')),
      phone: optionalText,
      username: z
        .string()
        .trim()
        .min(2)
        .max(40)
        .optional()
        .or(z.literal('')),
    })
    .extend(companyMemberOperationalFieldsSchema.shape),
  z
    .object({
      action: z.literal('update-member-profile'),
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().optional().or(z.literal('')),
      phone: optionalText,
    })
    .extend(companyMemberOperationalFieldsSchema.shape),
  z.object({
    action: z.literal('reset-member-credentials'),
    id: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('set-member-active'),
    id: z.string().trim().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('recompute-matches'),
  }),
  z.object({
    action: z.literal('create-manual-match'),
    contactId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('sync-modules'),
  }),
  z.object({
    action: z.literal('record-studio-output'),
    propertyId: z.string().trim().min(1),
    resultCount: z.coerce.number().int().min(1).max(100),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

function forbidden(message = 'Bu işlem yalnızca şirket patronuna açıktır.') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

function asNullable(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeWorkspacePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, '') || '';
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function scoreMatch(
  contact: {
    desiredLocation: string | null;
    desiredRoomCount: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
  },
  property: {
    location: string | null;
    roomCount: string | null;
    price: number | null;
  }
) {
  let score = 40;
  const reasons: string[] = [];
  const desiredLocation = contact.desiredLocation?.toLocaleLowerCase('tr-TR');
  const propertyLocation = property.location?.toLocaleLowerCase('tr-TR');

  if (
    desiredLocation &&
    propertyLocation &&
    (propertyLocation.includes(desiredLocation) ||
      desiredLocation.includes(propertyLocation))
  ) {
    score += 25;
    reasons.push('Bölge tercihi eşleşiyor');
  }

  if (
    contact.desiredRoomCount &&
    property.roomCount &&
    contact.desiredRoomCount === property.roomCount
  ) {
    score += 15;
    reasons.push('Oda sayısı eşleşiyor');
  }

  if (property.price != null) {
    const aboveMin = contact.budgetMin == null || property.price >= contact.budgetMin;
    const belowMax = contact.budgetMax == null || property.price <= contact.budgetMax;
    if (aboveMin && belowMax && (contact.budgetMin != null || contact.budgetMax != null)) {
      score += 20;
      reasons.push('Bütçe aralığında');
    } else if (!aboveMin || !belowMax) {
      score -= 15;
    }
  }

  if (reasons.length === 0) {
    reasons.push('Genel profil benzerliği');
  }

  return { score: Math.max(5, Math.min(99, score)), reasons };
}

async function ensureOwnedResource(
  model: 'contact' | 'property' | 'deal' | 'member',
  id: string | null | undefined,
  companyAccountId: string
) {
  if (!id) return null;

  const resource =
    model === 'contact'
      ? await prisma.crmContact.findFirst({ where: { id, companyAccountId }, select: { id: true } })
      : model === 'property'
        ? await prisma.crmProperty.findFirst({ where: { id, companyAccountId }, select: { id: true } })
        : model === 'deal'
          ? await prisma.crmDeal.findFirst({ where: { id, companyAccountId }, select: { id: true } })
          : await prisma.companyMember.findFirst({ where: { id, companyAccountId }, select: { id: true } });

  if (!resource) {
    throw new WorkspaceActionError('Seçilen kayıt bulunamadı.', 404);
  }
  return resource.id;
}

async function recomputeMatches(companyAccountId: string) {
  const [contacts, properties] = await Promise.all([
    prisma.crmContact.findMany({
      where: {
        companyAccountId,
        type: { in: ['BUYER', 'INVESTOR', 'TENANT'] },
        stage: { notIn: ['WON', 'LOST'] },
      },
    }),
    prisma.crmProperty.findMany({
      where: {
        companyAccountId,
        status: { in: ['ACTIVE', 'RESERVED'] },
      },
    }),
  ]);
  await prisma.crmMatch.deleteMany({
    where: { companyAccountId, status: { not: 'MANUAL' } },
  });
  const candidates = contacts.flatMap((contact) =>
    properties
      .map((property) => ({
        contactId: contact.id,
        propertyId: property.id,
        ...scoreMatch(contact, property),
      }))
      .filter((candidate) => candidate.score >= 45)
  );
  if (candidates.length > 0) {
    await prisma.crmMatch.createMany({
      data: candidates.map((candidate) => ({ companyAccountId, ...candidate })),
      skipDuplicates: true,
    });
  }
}

function scoreMetadata(
  metadata: string | null
): { reasons: string[]; source: 'AI' | 'RULES' } | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as {
      score?: unknown;
      reasons?: unknown;
      source?: unknown;
    };
    if (!Array.isArray(parsed.reasons)) return null;
    return {
      reasons: parsed.reasons.filter(
        (reason): reason is string => typeof reason === 'string'
      ),
      source: parsed.source === 'AI' ? 'AI' : 'RULES',
    };
  } catch {
    return null;
  }
}

async function getWorkspace(
  companyAccountId: string,
  permissions: {
    canManageTeam: boolean;
    canManageSecrets: boolean;
    canViewSubscription: boolean;
    canEditReports: boolean;
  }
) {
  const [
    account,
    members,
    contacts,
    properties,
    deals,
    tasks,
    matches,
    activities,
  ] = await Promise.all([
    prisma.companyAccount.findUniqueOrThrow({
      where: { id: companyAccountId },
      select: {
        id: true,
        companyName: true,
        brandLogoData: true,
        ownerName: true,
        ownerEmail: true,
        slug: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        workspaceEnabled: true,
        createdAt: true,
      },
    }),
    prisma.companyMember.findMany({
      where: { companyAccountId },
      select: {
        id: true,
        companyAccountId: true,
        name: true,
        email: true,
        phone: true,
        phoneNormalized: true,
        canReceiveWhatsAppTasks: true,
        allowAutomaticInternalMessages: true,
        preferredLanguage: true,
        workHours: true,
        availability: true,
        specialtyRegions: true,
        specialties: true,
        maxActiveTaskCapacity: true,
        lastAssignedAt: true,
        role: true,
        active: true,
        username: true,
        sessionVersion: true,
        lastLoginAt: true,
        credentialsUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.crmContact.findMany({
      where: { companyAccountId },
      include: { assignedMember: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.crmProperty.findMany({
      where: { companyAccountId },
      include: {
        ownerContact: { select: { id: true, name: true } },
        assignedMember: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.crmDeal.findMany({
      where: { companyAccountId },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true, location: true } },
        assignedMember: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.crmTask.findMany({
      where: { companyAccountId },
      include: {
        contact: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
        deal: { select: { id: true, title: true } },
        assignedMember: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.crmMatch.findMany({
      where: { companyAccountId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            desiredLocation: true,
            desiredRoomCount: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            roomCount: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: 100,
    }),
    prisma.crmActivity.findMany({
      where: { companyAccountId },
      include: {
        contact: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
        deal: { select: { id: true, title: true } },
        actorMember: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const pipelineValue = deals
    .filter((deal) => !['WON', 'LOST'].includes(deal.stage))
    .reduce((sum, deal) => sum + (deal.estimatedValue || 0), 0);
  const wonCommission = deals
    .filter((deal) => deal.stage === 'WON')
    .reduce(
      (sum, deal) =>
        sum +
        (deal.estimatedValue || 0) * ((deal.commissionRate || 0) / 100),
      0
    );
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const membersWithPerformance = members.map((member) => {
    const completedTasks = tasks.filter(
      (task) =>
        task.assignedMemberId === member.id &&
        task.status === 'COMPLETED' &&
        task.completedAt &&
        task.completedAt >= monthStart
    ).length;
    const openTasks = tasks.filter(
      (task) =>
        task.assignedMemberId === member.id && task.status === 'OPEN'
    ).length;
    const wonDeals = deals.filter(
      (deal) =>
        deal.assignedMemberId === member.id &&
        deal.stage === 'WON' &&
        deal.closedAt &&
        deal.closedAt >= monthStart
    ).length;
    const newProperties = properties.filter(
      (property) =>
        property.assignedMemberId === member.id &&
        property.createdAt >= monthStart
    ).length;

    return {
      ...member,
      monthlyPerformance: {
        completedTasks,
        openTasks,
        wonDeals,
        newProperties,
      },
    };
  });
  const scoreActivities = new Map<
    string,
    { reasons: string[]; source: 'AI' | 'RULES'; createdAt: Date }
  >();
  for (const activity of activities) {
    if (
      activity.type !== 'AI_SCORE_UPDATED' ||
      !activity.contactId ||
      scoreActivities.has(activity.contactId)
    ) {
      continue;
    }
    const parsed = scoreMetadata(activity.metadata);
    if (parsed) {
      scoreActivities.set(activity.contactId, {
        ...parsed,
        createdAt: activity.createdAt,
      });
    }
  }

  const phoneContactIds = new Map<string, string[]>();
  const emailContactIds = new Map<string, string[]>();
  for (const contact of contacts) {
    const phoneKey = contact.phoneNormalized || normalizeWorkspacePhone(contact.phone);
    const emailKey = contact.email?.trim().toLocaleLowerCase('tr-TR') || null;
    if (phoneKey) {
      phoneContactIds.set(phoneKey, [...(phoneContactIds.get(phoneKey) || []), contact.id]);
    }
    if (emailKey) {
      emailContactIds.set(emailKey, [...(emailContactIds.get(emailKey) || []), contact.id]);
    }
  }

  return {
    account: {
      id: account.id,
      companyName: account.companyName,
      brandLogoData: account.brandLogoData,
      ownerName: account.ownerName,
      ownerEmail: account.ownerEmail,
      slug: account.slug,
      subscriptionPlan: permissions.canViewSubscription
        ? account.subscriptionPlan
        : null,
      subscriptionStatus: permissions.canViewSubscription
        ? account.subscriptionStatus
        : null,
      subscriptionEndsAt: permissions.canViewSubscription
        ? account.subscriptionEndsAt
        : null,
      workspaceEnabled: account.workspaceEnabled,
      createdAt: account.createdAt,
    },
    permissions,
    members: membersWithPerformance,
    contacts: contacts.map((contact) => {
      const scoreActivity = scoreActivities.get(contact.id);
      const phoneKey = contact.phoneNormalized || normalizeWorkspacePhone(contact.phone);
      const emailKey = contact.email?.trim().toLocaleLowerCase('tr-TR') || null;
      const duplicateContactIds = new Set<string>([
        ...(phoneKey ? phoneContactIds.get(phoneKey) || [] : []),
        ...(emailKey ? emailContactIds.get(emailKey) || [] : []),
      ]);
      duplicateContactIds.delete(contact.id);
      return {
        ...contact,
        duplicateContactIds: [...duplicateContactIds],
        scoreReasons: scoreActivity?.reasons || [],
        scoreSource: scoreActivity?.source || null,
        scoreUpdatedAt: scoreActivity?.createdAt || null,
      };
    }),
    properties,
    deals,
    tasks,
    matches,
    activities,
    metrics: {
      contacts: contacts.length,
      activeProperties: properties.filter((property) => property.status === 'ACTIVE').length,
      openDeals: deals.filter((deal) => !['WON', 'LOST'].includes(deal.stage)).length,
      overdueTasks: tasks.filter(
        (task) =>
          task.status === 'OPEN' &&
          task.dueAt &&
          task.dueAt.getTime() < Date.now()
      ).length,
      upcomingCriticalTasks: tasks.filter(
        (task) =>
          task.status === 'OPEN' &&
          ['MEETING', 'VIEWING'].includes(task.type) &&
          task.dueAt &&
          task.dueAt.getTime() >= Date.now() &&
          task.dueAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000
      ).length,
      pipelineValue,
      wonCommission,
      averageMatchScore:
        matches.length > 0
          ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length)
          : 0,
    },
  };
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    await syncLegacyModulesToWorkspace(principal.account);
    await recomputeMatches(principal.account.id);
    return NextResponse.json({
      success: true,
      workspace: await getWorkspace(
        principal.account.id,
        principal.permissions
      ),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('Workspace GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Çalışma alanı yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const account = principal.account;
    const parsed = actionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Geçersiz işlem.',
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    let oneTimeCredentials: OneTimeMemberCredentials | undefined;

    if (input.action === 'create-contact') {
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );
      const contact = await prisma.crmContact.create({
        data: {
          companyAccountId: account.id,
          assignedMemberId,
          name: input.name,
          phone: asNullable(input.phone),
          phoneNormalized: normalizeWorkspacePhone(input.phone),
          email: asNullable(input.email),
          type: input.type,
          stage: input.stage,
          source: asNullable(input.source),
          desiredLocation: asNullable(input.desiredLocation),
          desiredRoomCount: asNullable(input.desiredRoomCount),
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          notes: asNullable(input.notes),
          consentStatus: input.consentStatus,
          consentUpdatedAt:
            input.consentStatus === ConsentStatus.UNKNOWN ? null : new Date(),
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId: contact.id,
          type: 'CONTACT_CREATED',
          title: 'Yeni müşteri CRM’e eklendi',
          description: contact.name,
        },
      });
    }

    if (input.action === 'update-contact') {
      const contactId = await ensureOwnedResource('contact', input.id, account.id);
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );
      const previous = await prisma.crmContact.findUniqueOrThrow({
        where: { id: contactId! },
        select: { stage: true, assignedMemberId: true },
      });
      const contact = await prisma.crmContact.update({
        where: { id: contactId! },
        data: {
          assignedMemberId,
          name: input.name,
          phone: asNullable(input.phone),
          phoneNormalized: normalizeWorkspacePhone(input.phone),
          email: asNullable(input.email),
          type: input.type,
          stage: input.stage,
          source: asNullable(input.source),
          desiredLocation: asNullable(input.desiredLocation),
          desiredRoomCount: asNullable(input.desiredRoomCount),
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          notes: asNullable(input.notes),
          tags: input.tags,
          consentStatus: input.consentStatus,
          consentUpdatedAt:
            input.consentStatus === ConsentStatus.UNKNOWN ? null : new Date(),
          nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId: contact.id,
          actorMemberId: principal.member?.id || null,
          type: 'CONTACT_UPDATED',
          title: 'Müşteri profili güncellendi',
          description:
            previous.stage !== contact.stage
              ? `Satış aşaması ${previous.stage} → ${contact.stage}`
              : previous.assignedMemberId !== contact.assignedMemberId
                ? 'Sorumlu danışman güncellendi'
                : 'Profil bilgileri yenilendi',
        },
      });
    }

    if (input.action === 'add-contact-note') {
      const contactId = await ensureOwnedResource('contact', input.id, account.id);
      const contact = await prisma.crmContact.findUniqueOrThrow({
        where: { id: contactId! },
        select: { notes: true },
      });
      const stamp = new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(new Date());
      await prisma.crmContact.update({
        where: { id: contactId! },
        data: {
          notes: [contact.notes, `[${stamp}] ${input.note}`]
            .filter(Boolean)
            .join('\n\n'),
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId,
          actorMemberId: principal.member?.id || null,
          type: 'CONTACT_NOTE',
          title: 'Müşteri notu eklendi',
          description: input.note,
        },
      });
    }

    if (input.action === 'score-contact') {
      const contactId = await ensureOwnedResource('contact', input.id, account.id);
      const contact = await prisma.crmContact.findUniqueOrThrow({
        where: { id: contactId! },
        include: {
          deals: {
            select: { stage: true, probability: true, estimatedValue: true },
          },
          tasks: {
            select: { status: true, priority: true, dueAt: true },
            orderBy: { createdAt: 'desc' },
            take: 30,
          },
          activities: {
            select: { type: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 30,
          },
        },
      });
      const result = await calculateCrmScore(contact);
      await prisma.$transaction([
        prisma.crmContact.update({
          where: { id: contact.id },
          data: { score: result.score },
        }),
        prisma.crmActivity.create({
          data: {
            companyAccountId: account.id,
            contactId: contact.id,
            actorMemberId: principal.member?.id || null,
            type: 'AI_SCORE_UPDATED',
            title:
              result.source === 'AI'
                ? 'AI müşteri puanını yeniledi'
                : 'Akıllı puan yedek kurallarla yenilendi',
            description: `${result.score}/100 · ${result.reasons.join(' · ')}`,
            metadata: JSON.stringify(result),
          },
        }),
      ]);
    }

    if (input.action === 'merge-contacts') {
      if (!principal.permissions.canManageTeam) {
        return forbidden('Müşteri kayıtlarını yalnızca şirket patronu birleştirebilir.');
      }
      const primaryId = await ensureOwnedResource('contact', input.primaryId, account.id);
      const duplicateId = await ensureOwnedResource('contact', input.duplicateId, account.id);

      await prisma.$transaction(async (tx) => {
        const [primary, duplicate] = await Promise.all([
          tx.crmContact.findUniqueOrThrow({ where: { id: primaryId! } }),
          tx.crmContact.findUniqueOrThrow({
            where: { id: duplicateId! },
            include: { matches: true },
          }),
        ]);

        for (const match of duplicate.matches) {
          const existing = await tx.crmMatch.findUnique({
            where: {
              companyAccountId_contactId_propertyId: {
                companyAccountId: account.id,
                contactId: primary.id,
                propertyId: match.propertyId,
              },
            },
          });
          if (existing) {
            await tx.crmMatch.update({
              where: { id: existing.id },
              data: {
                score: Math.max(existing.score, match.score),
                reasons: [...new Set([...existing.reasons, ...match.reasons])],
              },
            });
            await tx.crmMatch.delete({ where: { id: match.id } });
          } else {
            await tx.crmMatch.update({
              where: { id: match.id },
              data: { contactId: primary.id },
            });
          }
        }

        await Promise.all([
          tx.crmProperty.updateMany({ where: { ownerContactId: duplicate.id }, data: { ownerContactId: primary.id } }),
          tx.crmDeal.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } }),
          tx.crmTask.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } }),
          tx.crmActivity.updateMany({ where: { contactId: duplicate.id }, data: { contactId: primary.id } }),
        ]);

        await tx.crmContact.delete({ where: { id: duplicate.id } });
        await tx.crmContact.update({
          where: { id: primary.id },
          data: {
            phone: primary.phone || duplicate.phone,
            phoneNormalized:
              primary.phoneNormalized ||
              duplicate.phoneNormalized ||
              normalizeWorkspacePhone(primary.phone || duplicate.phone),
            email: primary.email || duplicate.email,
            source: primary.source || duplicate.source,
            desiredLocation: primary.desiredLocation || duplicate.desiredLocation,
            desiredRoomCount: primary.desiredRoomCount || duplicate.desiredRoomCount,
            budgetMin: primary.budgetMin ?? duplicate.budgetMin,
            budgetMax: primary.budgetMax ?? duplicate.budgetMax,
            notes: [primary.notes, duplicate.notes]
              .filter(Boolean)
              .join('\n\n--- Birleştirilen kayıt ---\n'),
            tags: [...new Set([...primary.tags, ...duplicate.tags])],
            score: Math.max(primary.score, duplicate.score),
            assignedMemberId: primary.assignedMemberId || duplicate.assignedMemberId,
            sourceConversationId:
              primary.sourceConversationId || duplicate.sourceConversationId,
          },
        });
        await tx.crmActivity.create({
          data: {
            companyAccountId: account.id,
            contactId: primary.id,
            actorMemberId: principal.member?.id || null,
            type: 'CONTACT_MERGED',
            title: 'Yinelenen müşteri kaydı birleştirildi',
            description: `${duplicate.name} kaydı ${primary.name} kaydıyla birleştirildi.`,
            metadata: JSON.stringify({ mergedContactId: duplicate.id }),
          },
        });
        await tx.managerAuditLog.create({
          data: {
            companyAccountId: account.id,
            actorType: principal.type,
            actorId: principal.member?.id || account.id,
            operation: 'CRM_CONTACT_MERGE',
            entityType: 'CrmContact',
            entityId: primary.id,
            verifiedContext: {
              primaryContactId: primary.id,
              mergedContactId: duplicate.id,
              movedRelations: ['properties', 'deals', 'tasks', 'matches', 'activities'],
            },
            policyDecision: 'OWNER_CONFIRMED',
            result: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      });
    }

    if (input.action === 'create-property') {
      const ownerContactId = await ensureOwnedResource(
        'contact',
        input.ownerContactId,
        account.id
      );
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );
      const property = await prisma.crmProperty.create({
        data: {
          companyAccountId: account.id,
          ownerContactId,
          assignedMemberId,
          title: input.title,
          referenceCode: asNullable(input.referenceCode),
          location: asNullable(input.location),
          price: input.price,
          roomCount: asNullable(input.roomCount),
          area: input.area,
          status: input.status,
          description: asNullable(input.description),
          imageUrl: asNullable(input.imageUrl),
        },
      });
      if (input.imageUrl) {
        await prisma.crmPropertyMedia.create({
          data: {
            companyAccountId: account.id,
            propertyId: property.id,
            url: input.imageUrl,
            fileName: `portfoy-kapak-${property.id}.jpg`,
            mimeType: 'image/jpeg',
            sortOrder: 0,
            isCover: true,
            mediaType: 'PHOTO',
            source: 'MANUAL_UPLOAD',
            variantType: 'ORIGINAL',
            usageRightsStatus: 'CONFIRMED',
            fingerprint: `property-create:${property.id}`,
            provenance: { uploadedFrom: 'LEGACY_PROPERTY_CREATE_FORM' },
            createdByMemberId: principal.member?.id ?? null,
          },
        });
      }
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          propertyId: property.id,
          type: 'PROPERTY_CREATED',
          title: 'Yeni portföy eklendi',
          description: property.title,
        },
      });
    }

    if (input.action === 'update-property') {
      const propertyId = await ensureOwnedResource('property', input.id, account.id);
      const ownerContactId = await ensureOwnedResource(
        'contact',
        input.ownerContactId,
        account.id
      );
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );

      await prisma.$transaction(async (tx) => {
        const previous = await tx.crmProperty.findFirst({
          where: { id: propertyId!, companyAccountId: account.id },
          select: { id: true, title: true, imageUrl: true, status: true },
        });
        if (!previous) throw new WorkspaceActionError('Portföy bulunamadı.', 404);
        if (previous.status !== input.status) {
          throw new WorkspaceActionError(
            'Yayın durumu portföy kartındaki yayına al veya yayından kaldır işlemiyle değiştirilmelidir.'
          );
        }

        const nextImageUrl = asNullable(input.imageUrl);
        const updated = await tx.crmProperty.updateMany({
          where: { id: propertyId!, companyAccountId: account.id },
          data: {
            ownerContactId,
            assignedMemberId,
            title: input.title,
            referenceCode: asNullable(input.referenceCode),
            location: asNullable(input.location),
            price: input.price,
            roomCount: asNullable(input.roomCount),
            area: input.area,
            description: asNullable(input.description),
            imageUrl: nextImageUrl,
          },
        });
        if (updated.count !== 1) {
          throw new WorkspaceActionError('Portföy güncellenemedi.');
        }

        if (nextImageUrl && nextImageUrl !== previous.imageUrl) {
          await tx.crmPropertyMedia.updateMany({
            where: {
              companyAccountId: account.id,
              propertyId: propertyId!,
              isCover: true,
            },
            data: { isCover: false },
          });
          const existingMedia = await tx.crmPropertyMedia.findFirst({
            where: {
              companyAccountId: account.id,
              propertyId: propertyId!,
              url: nextImageUrl,
            },
            select: { id: true },
          });
          if (existingMedia) {
            await tx.crmPropertyMedia.update({
              where: { id: existingMedia.id },
              data: { isCover: true, sortOrder: 0 },
            });
          } else {
            await tx.crmPropertyMedia.create({
              data: {
                companyAccountId: account.id,
                propertyId: propertyId!,
                url: nextImageUrl,
                fileName: `portfoy-kapak-${propertyId}.jpg`,
                mimeType: 'image/jpeg',
                sortOrder: 0,
                isCover: true,
                mediaType: 'PHOTO',
                source: 'MANUAL_UPLOAD',
                variantType: 'ORIGINAL',
                usageRightsStatus: 'CONFIRMED',
                fingerprint: `property-update:${propertyId}:${Date.now()}`,
                provenance: { uploadedFrom: 'LEGACY_PROPERTY_EDIT_FORM' },
                createdByMemberId: principal.member?.id ?? null,
              },
            });
          }
        }

        await tx.crmActivity.create({
          data: {
            companyAccountId: account.id,
            propertyId,
            actorMemberId: principal.member?.id || null,
            type: 'PROPERTY_UPDATED',
            title: 'Portföy bilgileri güncellendi',
            description: input.title,
          },
        });
        await tx.managerAuditLog.create({
          data: {
            companyAccountId: account.id,
            actorType: principal.type,
            actorId: principal.member?.id || account.id,
            operation: 'CRM_PROPERTY_UPDATE',
            entityType: 'CrmProperty',
            entityId: propertyId,
            verifiedContext: {
              previousTitle: previous.title,
              title: input.title,
              imageChanged: nextImageUrl !== previous.imageUrl,
            },
            policyDecision: 'TENANT_SCOPED_USER_ACTION',
            result: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      });
    }

    if (input.action === 'set-property-status') {
      const propertyId = await ensureOwnedResource(
        'property',
        input.id,
        account.id
      );
      await prisma.$transaction(async (tx) => {
        const existingEvent = await tx.operationEvent.findUnique({
          where: {
            companyAccountId_idempotencyKey: {
              companyAccountId: account.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { id: true },
        });
        if (existingEvent) return;

        const previous = await tx.crmProperty.findFirst({
          where: { id: propertyId!, companyAccountId: account.id },
          select: {
            status: true,
            title: true,
            publicationApprovedAt: true,
            authorityDocumentVerifiedAt: true,
            authorityExpiresAt: true,
            eidsRequired: true,
            eidsVerifiedAt: true,
            eidsVerificationReference: true,
            eidsExemptionReason: true,
            publicationBlockedAt: true,
          },
        });
        if (!previous) throw new Error('Portföy bulunamadı.');

        if (input.status === 'ACTIVE') {
          const { isPropertyPublishable } = await import('@/lib/property-publication');
          if (
            !isPropertyPublishable(
              { ...previous, companyAccountId: account.id, status: 'ACTIVE' },
              { companyAccountId: account.id, now: new Date() }
            )
          ) {
            throw new Error('Portföy yayın onayı, yetki belgesi ve EİDS doğrulaması tamamlanmalıdır.');
          }
        }

        await tx.crmProperty.update({
          where: { id: propertyId! },
          data: {
            status: input.status,
            publishedAt: input.status === 'ACTIVE' ? new Date() : null,
          },
        });
        const event = await tx.operationEvent.create({
          data: {
            companyAccountId: account.id,
            eventType:
              input.status === 'ACTIVE'
                ? 'PROPERTY_PUBLISHED'
                : 'PROPERTY_UNPUBLISHED',
            entityType: 'CrmProperty',
            entityId: propertyId,
            propertyId,
            actorType: principal.type,
            actorId: principal.member?.id || account.id,
            metadata: {
              version: 1,
              previousStatus: previous.status,
              status: input.status,
              target: 'FABRIKA_AND_WEBSITE_CONNECTOR',
            },
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.crmActivity.create({
          data: {
            companyAccountId: account.id,
            propertyId,
            actorMemberId: principal.member?.id || null,
            type:
              input.status === 'ACTIVE'
                ? 'PROPERTY_PUBLISHED'
                : 'PROPERTY_UNPUBLISHED',
            title:
              input.status === 'ACTIVE'
                ? 'Portföy yayına alındı'
                : 'Portföy yayından kaldırıldı',
            description: previous.title,
          },
        });
        await tx.managerAuditLog.create({
          data: {
            companyAccountId: account.id,
            operationEventId: event.id,
            actorType: principal.type,
            actorId: principal.member?.id || account.id,
            operation:
              input.status === 'ACTIVE'
                ? 'PROPERTY_PUBLISH'
                : 'PROPERTY_UNPUBLISH',
            entityType: 'CrmProperty',
            entityId: propertyId,
            verifiedContext: {
              previousStatus: previous.status,
              status: input.status,
            },
            policyDecision: 'USER_INITIATED_REVERSIBLE',
            result: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      });
    }

    if (input.action === 'approve-property-publication') {
      if (principal.type !== 'OWNER') return forbidden();
      const propertyId = await ensureOwnedResource('property', input.id, account.id);
      const document = await prisma.companyDocument.findFirst({
        where: {
          id: input.authorizationDocumentId,
          companyAccountId: account.id,
          status: 'GENERATED',
          legalStatus: { in: ['COMPANY_APPROVED', 'LEGAL_REVIEWED'] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!document) {
        return NextResponse.json(
          { success: false, error: 'Doğrulanmış ve şirketçe onaylanmış yetki belgesi bulunamadı.' },
          { status: 409 }
        );
      }
      const now = new Date();
      const authorityExpiresAt = input.authorityExpiresAt ? new Date(input.authorityExpiresAt) : null;
      if (authorityExpiresAt && authorityExpiresAt.getTime() <= now.getTime()) {
        return NextResponse.json(
          { success: false, error: 'Yetki belgesinin geçerlilik süresi dolmuş.' },
          { status: 409 }
        );
      }
      await prisma.$transaction(async (tx) => {
        const existing = await tx.operationEvent.findUnique({
          where: {
            companyAccountId_idempotencyKey: {
              companyAccountId: account.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) return;
        await tx.crmProperty.update({
          where: { id: propertyId! },
          data: {
            status: 'ACTIVE',
            publicationApprovedAt: now,
            publicationApprovedById: account.id,
            publicationAuthorizationDocumentId: document.id,
            authorityDocumentVerifiedAt: now,
            authorityExpiresAt,
            eidsRequired: input.eidsRequired,
            eidsVerifiedAt: input.eidsRequired ? now : null,
            eidsVerificationReference: input.eidsRequired ? input.eidsVerificationReference : null,
            eidsExemptionReason: input.eidsRequired ? null : input.eidsExemptionReason,
            publicationBlockedAt: null,
            publicationBlockReason: null,
            publishedAt: now,
          },
        });
        await tx.operationEvent.create({
          data: {
            companyAccountId: account.id,
            eventType: 'PROPERTY_PUBLISHED',
            entityType: 'CrmProperty',
            entityId: propertyId,
            propertyId,
            actorType: principal.type,
            actorId: account.id,
            metadata: {
              version: 1,
              authorizationDocumentId: document.id,
              eidsRequired: input.eidsRequired,
            },
            idempotencyKey: input.idempotencyKey,
          },
        });
      });
    }

    if (input.action === 'create-deal') {
      const contactId = await ensureOwnedResource('contact', input.contactId, account.id);
      const propertyId = await ensureOwnedResource('property', input.propertyId, account.id);
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );
      const deal = await prisma.crmDeal.create({
        data: {
          companyAccountId: account.id,
          contactId: contactId!,
          propertyId,
          assignedMemberId,
          title: input.title,
          estimatedValue: input.estimatedValue,
          commissionRate: input.commissionRate,
          nextAction: asNullable(input.nextAction),
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId,
          propertyId,
          dealId: deal.id,
          type: 'DEAL_CREATED',
          title: 'Yeni satış fırsatı açıldı',
          description: deal.title,
        },
      });
    }

    if (input.action === 'move-deal') {
      const deal = await prisma.crmDeal.findFirst({
        where: { id: input.id, companyAccountId: account.id },
      });
      if (!deal) throw new Error('Satış fırsatı bulunamadı.');
      await prisma.crmDeal.update({
        where: { id: deal.id },
        data: {
          stage: input.stage,
          probability:
            input.stage === 'WON'
              ? 100
              : input.stage === 'LOST'
                ? 0
                : {
                    NEW: 20,
                    CONTACTED: 30,
                    QUALIFIED: 45,
                    MATCHED: 55,
                    VIEWING: 65,
                    OFFER: 80,
                    CONTRACT: 90,
                  }[input.stage] || deal.probability,
          closedAt: ['WON', 'LOST'].includes(input.stage) ? new Date() : null,
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId: deal.contactId,
          propertyId: deal.propertyId,
          dealId: deal.id,
          type: 'DEAL_STAGE_CHANGED',
          title: 'Satış aşaması güncellendi',
          description: `${deal.title} · ${input.stage}`,
        },
      });
    }

    if (input.action === 'create-task') {
      const contactId = await ensureOwnedResource('contact', input.contactId, account.id);
      const propertyId = await ensureOwnedResource('property', input.propertyId, account.id);
      const dealId = await ensureOwnedResource('deal', input.dealId, account.id);
      const assignedMemberId = await ensureOwnedResource(
        'member',
        input.assignedMemberId,
        account.id
      );
      await prisma.crmTask.create({
        data: {
          companyAccountId: account.id,
          contactId,
          propertyId,
          dealId,
          assignedMemberId,
          title: input.title,
          type: input.type,
          description: asNullable(input.description),
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          priority: input.priority,
        },
      });
    }

    if (input.action === 'toggle-task') {
      const task = await prisma.crmTask.findFirst({
        where: { id: input.id, companyAccountId: account.id },
      });
      if (!task) throw new Error('Görev bulunamadı.');
      await prisma.crmTask.update({
        where: { id: task.id },
        data: {
          status: input.completed ? CrmTaskStatus.COMPLETED : CrmTaskStatus.OPEN,
          completedAt: input.completed ? new Date() : null,
        },
      });
    }

    if (input.action === 'create-member') {
      if (!principal.permissions.canManageTeam) {
        throw new FabrikaForbiddenError();
      }
      const result = await createCompanyMemberAccount({
        companyAccountId: account.id,
        name: input.name,
        email: asNullable(input.email),
        phone: asNullable(input.phone),
        username: asNullable(input.username),
        role: input.role,
        canReceiveWhatsAppTasks: input.canReceiveWhatsAppTasks,
        allowAutomaticInternalMessages:
          input.allowAutomaticInternalMessages,
        preferredLanguage: input.preferredLanguage,
        workHours: input.workHours,
        availability: input.availability,
        specialtyRegions: input.specialtyRegions,
        specialties: input.specialties,
        maxActiveTaskCapacity: input.maxActiveTaskCapacity,
      });
      oneTimeCredentials = result.credentials;
    }

    if (input.action === 'update-member-profile') {
      if (!principal.permissions.canManageTeam) {
        throw new FabrikaForbiddenError();
      }
      await updateCompanyMemberProfile({
        companyAccountId: account.id,
        memberId: input.id,
        name: input.name,
        email: input.email === undefined ? undefined : asNullable(input.email),
        phone: input.phone === undefined ? undefined : asNullable(input.phone),
        role: input.role,
        canReceiveWhatsAppTasks: input.canReceiveWhatsAppTasks,
        allowAutomaticInternalMessages:
          input.allowAutomaticInternalMessages,
        preferredLanguage: input.preferredLanguage,
        workHours: input.workHours,
        availability: input.availability,
        specialtyRegions: input.specialtyRegions,
        specialties: input.specialties,
        maxActiveTaskCapacity: input.maxActiveTaskCapacity,
      });
    }

    if (input.action === 'reset-member-credentials') {
      if (!principal.permissions.canManageTeam) {
        throw new FabrikaForbiddenError();
      }
      const result = await resetCompanyMemberCredentials({
        companyAccountId: account.id,
        memberId: input.id,
      });
      oneTimeCredentials = result.credentials;
    }

    if (input.action === 'set-member-active') {
      if (!principal.permissions.canManageTeam) {
        throw new FabrikaForbiddenError();
      }
      await setCompanyMemberActive({
        companyAccountId: account.id,
        memberId: input.id,
        active: input.active,
      });
    }

    if (input.action === 'recompute-matches') {
      await recomputeMatches(account.id);
    }

    if (input.action === 'create-manual-match') {
      const contactId = await ensureOwnedResource(
        'contact',
        input.contactId,
        account.id
      );
      const propertyId = await ensureOwnedResource(
        'property',
        input.propertyId,
        account.id
      );
      const [contact, property] = await Promise.all([
        prisma.crmContact.findUniqueOrThrow({ where: { id: contactId! } }),
        prisma.crmProperty.findUniqueOrThrow({ where: { id: propertyId! } }),
      ]);
      const calculated = scoreMatch(contact, property);
      await prisma.crmMatch.upsert({
        where: {
          companyAccountId_contactId_propertyId: {
            companyAccountId: account.id,
            contactId: contact.id,
            propertyId: property.id,
          },
        },
        update: {
          score: calculated.score,
          reasons: ['Danışman tarafından eşleştirildi', ...calculated.reasons],
          status: 'MANUAL',
        },
        create: {
          companyAccountId: account.id,
          contactId: contact.id,
          propertyId: property.id,
          score: calculated.score,
          reasons: ['Danışman tarafından eşleştirildi', ...calculated.reasons],
          status: 'MANUAL',
        },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          contactId: contact.id,
          propertyId: property.id,
          actorMemberId: principal.member?.id || null,
          type: 'MATCH_CREATED',
          title: 'Manuel müşteri-portföy eşleşmesi',
          description: `${contact.name} · ${property.title}`,
        },
      });
    }

    if (input.action === 'sync-modules') {
      const summary = await syncLegacyModulesToWorkspace(account);
      await recomputeMatches(account.id);
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          type: 'MODULE_SYNC',
          title: 'Fabrika modülleri eşitlendi',
          description: `${summary.conversations} konuşma, ${summary.listings} portföy, ${summary.appointments} randevu ve ${summary.campaigns} kampanya işlendi.`,
        },
      });
    }

    if (input.action === 'record-studio-output') {
      const propertyId = await ensureOwnedResource('property', input.propertyId, account.id);
      const property = await prisma.crmProperty.findUniqueOrThrow({
        where: { id: propertyId! },
        select: { title: true },
      });
      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          propertyId,
          type: 'STUDIO_OUTPUT_READY',
          title: 'Stüdyo görselleri hazırlandı',
          description: `${property.title} için ${input.resultCount} görsel iyileştirildi.`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      workspace: await getWorkspace(account.id, principal.permissions),
      oneTimeCredentials,
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    if (error instanceof FabrikaForbiddenError) return forbidden(error.message);
    if (error instanceof WorkspaceActionError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof CompanyMemberValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bu e-posta, telefon veya kullanıcı adı başka bir çalışan hesabında kullanılıyor.',
        },
        { status: 409 }
      );
    }
    console.error('Workspace POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'İşlem tamamlanamadı.',
      },
      { status: 500 }
    );
  }
}
