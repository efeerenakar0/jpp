import {
  ConsentStatus,
  CrmContactStage,
  CrmContactType,
  CrmPropertyStatus,
  CrmTaskStatus,
  CrmTaskType,
} from '@prisma/client';
import prisma from '@/lib/prisma';

type WorkspaceAccount = {
  id: string;
  slug: string;
};

function parseListingNumber(value?: string | null) {
  if (!value) return null;
  const normalized = value
    .replace(/[^\d,.]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function legacyPropertyStatus(status: string, syncedToSite: boolean) {
  if (status === 'RED') return CrmPropertyStatus.ARCHIVED;
  if (syncedToSite || status === 'GREEN') return CrmPropertyStatus.ACTIVE;
  return CrmPropertyStatus.DRAFT;
}

async function getOrCreateSeller(
  companyAccountId: string,
  listing: { ownerName: string | null; ownerPhone: string | null; title: string }
) {
  const phone = listing.ownerPhone?.replace(/\D/g, '') || null;
  const ownerName = listing.ownerName?.trim() || null;
  if (!phone && !ownerName) return null;

  const existing = await prisma.crmContact.findFirst({
    where: phone
      ? { companyAccountId, phone }
      : {
          companyAccountId,
          name: ownerName!,
          type: CrmContactType.SELLER,
          source: 'Avcı · İlan sahibi',
        },
    select: { id: true },
  });

  if (existing) return existing.id;

  const seller = await prisma.crmContact.create({
    data: {
      companyAccountId,
      name: ownerName || `${listing.title} sahibi`,
      phone,
      type: CrmContactType.SELLER,
      stage: CrmContactStage.CONTACTED,
      source: 'Avcı · İlan sahibi',
      score: 60,
      consentStatus: ConsentStatus.UNKNOWN,
    },
    select: { id: true },
  });
  return seller.id;
}

/**
 * Mirrors legacy Jasmine modules into the tenant-scoped real-estate workspace.
 * Legacy data has no company key, therefore only the original Jasmine account is
 * eligible for this bridge. New companies remain isolated by default.
 */
export async function syncLegacyModulesToWorkspace(account: WorkspaceAccount) {
  if (account.slug !== 'jasmine-group') {
    return { conversations: 0, listings: 0, appointments: 0, campaigns: 0 };
  }

  const [conversations, listings, appointments, campaigns] = await Promise.all([
    prisma.customerConversation.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.huntedListing.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.appointmentRequest.findMany({
      include: { conversation: { select: { id: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.adCampaign.findMany({
      include: { adCopies: { select: { listingId: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
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
        stage: conversation.isActive ? CrmContactStage.CONTACTED : CrmContactStage.LOST,
        score: conversation.isActive ? 70 : 45,
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
        stage: conversation.isActive ? CrmContactStage.CONTACTED : CrmContactStage.LOST,
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
    const ownerContactId = await getOrCreateSeller(account.id, listing);
    await prisma.crmProperty.upsert({
      where: {
        companyAccountId_sourceListingId: {
          companyAccountId: account.id,
          sourceListingId: listing.id,
        },
      },
      update: {
        ownerContactId,
        title: listing.title,
        location: listing.location,
        roomCount: listing.roomCount,
        price: parseListingNumber(listing.price),
        area: parseListingNumber(listing.area),
        imageUrl: listing.imageUrl,
        description: listing.notes,
        status: legacyPropertyStatus(listing.status, listing.syncedToSite),
      },
      create: {
        companyAccountId: account.id,
        sourceListingId: listing.id,
        ownerContactId,
        title: listing.title,
        location: listing.location,
        roomCount: listing.roomCount,
        price: parseListingNumber(listing.price),
        area: parseListingNumber(listing.area),
        imageUrl: listing.imageUrl,
        description: listing.notes,
        status: legacyPropertyStatus(listing.status, listing.syncedToSite),
        referenceCode: `AV-${listing.id.slice(-6).toUpperCase()}`,
      },
    });
  }

  for (const appointment of appointments) {
    const contact = await prisma.crmContact.findFirst({
      where: { companyAccountId: account.id, sourceConversationId: appointment.conversationId },
      select: { id: true },
    });
    if (!contact) continue;

    const marker = `[appointment:${appointment.id}]`;
    const existingTask = await prisma.crmTask.findFirst({
      where: { companyAccountId: account.id, description: { contains: marker } },
      select: { id: true },
    });
    const taskData = {
      contactId: contact.id,
      title: `Randevu · ${appointment.customerName}`,
      type: CrmTaskType.MEETING,
      description: `${marker}\n${appointment.patronNote || 'Asistan tarafından oluşturulan randevu.'}`,
      dueAt: appointment.proposedDate,
      status:
        appointment.status === 'CANCELLED' || appointment.status === 'REJECTED'
          ? CrmTaskStatus.CANCELLED
          : CrmTaskStatus.OPEN,
      completedAt: null,
    };
    if (existingTask) {
      await prisma.crmTask.update({ where: { id: existingTask.id }, data: taskData });
    } else {
      await prisma.crmTask.create({ data: { companyAccountId: account.id, ...taskData } });
    }
  }

  for (const campaign of campaigns) {
    const listingId = campaign.adCopies.find((copy) => copy.listingId)?.listingId;
    const property = listingId
      ? await prisma.crmProperty.findFirst({
          where: { companyAccountId: account.id, sourceListingId: listingId },
          select: { id: true },
        })
      : null;
    const marker = `campaign:${campaign.id}`;
    const existingActivity = await prisma.crmActivity.findFirst({
      where: { companyAccountId: account.id, metadata: { contains: marker } },
      select: { id: true },
    });
    const activityData = {
      propertyId: property?.id || null,
      type: 'MARKETING_CAMPAIGN',
      title: 'Pazarlamacı kampanyası hazır',
      description: campaign.name,
      metadata: marker,
    };
    if (existingActivity) {
      await prisma.crmActivity.update({ where: { id: existingActivity.id }, data: activityData });
    } else {
      await prisma.crmActivity.create({ data: { companyAccountId: account.id, ...activityData } });
    }
  }

  return {
    conversations: conversations.length,
    listings: listings.length,
    appointments: appointments.length,
    campaigns: campaigns.length,
  };
}
