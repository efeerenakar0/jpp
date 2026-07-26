import { NextResponse } from 'next/server';
import {
  CompanyMemberRole,
  ConsentStatus,
  CrmContactStage,
  CrmContactType,
  CrmDealStage,
  CrmPropertyStatus,
  CrmTaskStatus,
  CrmTaskType,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaAccount,
} from '@/lib/fabrika-session';

const optionalText = z.string().trim().max(500).optional().nullable();
const optionalId = z.string().trim().min(1).optional().nullable();
const optionalNumber = z.coerce.number().finite().nonnegative().optional().nullable();

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
  z.object({
    action: z.literal('create-member'),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().optional().or(z.literal('')),
    phone: optionalText,
    role: z.nativeEnum(CompanyMemberRole).default(CompanyMemberRole.AGENT),
  }),
  z.object({
    action: z.literal('recompute-matches'),
  }),
  z.object({
    action: z.literal('sync-modules'),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

function asNullable(value: string | null | undefined) {
  return value?.trim() || null;
}

function parseListingNumber(value?: string | null) {
  if (!value) return null;
  const normalized = value
    .replace(/[^\d,.]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
    throw new Error('Seçilen kayıt bu şirkete ait değil.');
  }
  return resource.id;
}

async function getWorkspace(companyAccountId: string) {
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

  return {
    account,
    members,
    contacts,
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
    const account = await requireFabrikaAccount();
    return NextResponse.json({
      success: true,
      workspace: await getWorkspace(account.id),
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
    const account = await requireFabrikaAccount();
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
      await prisma.companyMember.create({
        data: {
          companyAccountId: account.id,
          name: input.name,
          email: asNullable(input.email),
          phone: asNullable(input.phone),
          role: input.role,
        },
      });
    }

    if (input.action === 'recompute-matches') {
      const [contacts, properties] = await Promise.all([
        prisma.crmContact.findMany({
          where: {
            companyAccountId: account.id,
            type: { in: ['BUYER', 'INVESTOR', 'TENANT'] },
            stage: { notIn: ['WON', 'LOST'] },
          },
        }),
        prisma.crmProperty.findMany({
          where: {
            companyAccountId: account.id,
            status: { in: ['ACTIVE', 'RESERVED'] },
          },
        }),
      ]);
      await prisma.crmMatch.deleteMany({ where: { companyAccountId: account.id } });
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
          data: candidates.map((candidate) => ({
            companyAccountId: account.id,
            ...candidate,
          })),
        });
      }
    }

    if (input.action === 'sync-modules') {
      if (account.slug !== 'jasmine-group') {
        return NextResponse.json({
          success: true,
          workspace: await getWorkspace(account.id),
          message: 'Bu şirket için henüz aktarılacak eski modül verisi yok.',
        });
      }

      const [conversations, listings] = await Promise.all([
        prisma.customerConversation.findMany({ orderBy: { updatedAt: 'desc' } }),
        prisma.huntedListing.findMany({ orderBy: { updatedAt: 'desc' } }),
      ]);

      for (const conversation of conversations) {
        await prisma.crmContact.upsert({
          where: {
            companyAccountId_sourceConversationId: {
              companyAccountId: account.id,
              sourceConversationId: conversation.id,
            },
          },
          update: {
            name: conversation.customerName,
            phone: conversation.customerPhone,
            email: conversation.customerEmail,
            notes: conversation.notes || conversation.summary,
            tags: conversation.tags,
          },
          create: {
            companyAccountId: account.id,
            sourceConversationId: conversation.id,
            name: conversation.customerName,
            phone: conversation.customerPhone,
            email: conversation.customerEmail,
            type:
              conversation.intent === 'INVESTMENT'
                ? CrmContactType.INVESTOR
                : CrmContactType.BUYER,
            source: `Asistan · ${conversation.channel}`,
            notes: conversation.notes || conversation.summary,
            tags: conversation.tags,
            score: conversation.isActive ? 70 : 45,
            stage: conversation.isActive
              ? CrmContactStage.CONTACTED
              : CrmContactStage.LOST,
            consentStatus:
              conversation.channel === 'WHATSAPP'
                ? ConsentStatus.GRANTED
                : ConsentStatus.UNKNOWN,
            consentUpdatedAt:
              conversation.channel === 'WHATSAPP'
                ? conversation.lastCustomerMessageAt || conversation.updatedAt
                : null,
          },
        });
      }

      for (const listing of listings) {
        await prisma.crmProperty.upsert({
          where: {
            companyAccountId_sourceListingId: {
              companyAccountId: account.id,
              sourceListingId: listing.id,
            },
          },
          update: {
            title: listing.title,
            location: listing.location,
            roomCount: listing.roomCount,
            price: parseListingNumber(listing.price),
            imageUrl: listing.imageUrl,
          },
          create: {
            companyAccountId: account.id,
            sourceListingId: listing.id,
            title: listing.title,
            location: listing.location,
            roomCount: listing.roomCount,
            price: parseListingNumber(listing.price),
            area: parseListingNumber(listing.area),
            imageUrl: listing.imageUrl,
            description: listing.notes,
            status:
              listing.status === 'GREEN'
                ? CrmPropertyStatus.ACTIVE
                : listing.status === 'RED'
                  ? CrmPropertyStatus.ARCHIVED
                  : CrmPropertyStatus.DRAFT,
            referenceCode: `AV-${listing.id.slice(-6).toUpperCase()}`,
          },
        });
      }

      await prisma.crmActivity.create({
        data: {
          companyAccountId: account.id,
          type: 'MODULE_SYNC',
          title: 'AI modülleri CRM ile eşitlendi',
          description: `${conversations.length} konuşma ve ${listings.length} Avcı kaydı işlendi.`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      workspace: await getWorkspace(account.id),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
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
