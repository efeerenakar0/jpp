import { callAI } from '@/lib/ai';
import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { phoneHmac } from '@/lib/hunting-v2/contact-crypto';
import { prisma } from '@/lib/prisma';

import { recordOperationEvent } from './events';
import { orchestratePropertyOwnerInterest } from './lead-orchestration';

function authorizationSignal(text: string) {
  const normalized = text.toLocaleLowerCase('tr-TR');
  const confirmed =
    /(satış|satis|kiralama)?\s*yetki(si|sini)?\s*(veriyorum|onaylıyorum|onayliyorum)|sözleşmeyi\s*(imzaladım|imzaladim)/i.test(
      normalized
    );
  const interested =
    confirmed ||
    /(görüşelim|goruselim|detay|yetki|komisyon|şartlar|sartlar|olabilir)/i.test(
      normalized
    );
  return { confirmed, interested };
}

export async function processVerifiedPropertyOwnerWhatsAppMessage(input: {
  companyAccountId: string;
  listingId: string;
  text: string;
  provider: string;
  providerMessageId: string;
  fromPhone: string;
}) {
  const existingInbound = input.providerMessageId
    ? await prisma.whatsAppMessage.findFirst({
        where: {
          companyAccountId: input.companyAccountId,
          providerMessageId: input.providerMessageId,
        },
        select: { id: true },
      })
    : null;
  const [listing, huntedContact] = await Promise.all([
    prisma.huntedListing.findFirst({
      where: {
        id: input.listingId,
        companyAccountId: input.companyAccountId,
      },
    }),
    prisma.huntedContact.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        listingId: input.listingId,
        phoneHmac: phoneHmac(input.fromPhone),
      },
      select: { id: true },
    }),
  ]);
  if (!listing) throw new Error('Portföy adayı bu şirkette bulunamadı.');
  if (!huntedContact) {
    throw new Error(
      'Malik yanıtı doğrulanmış ve bu şirkete ait iletişim kaydıyla eşleşmedi.'
    );
  }

  const signal = authorizationSignal(input.text);
  const event = signal.interested
    ? await recordOperationEvent({
        companyAccountId: input.companyAccountId,
        eventType: 'AUTHORIZATION_INTEREST',
        entityType: 'HUNTED_LISTING',
        entityId: listing.id,
        actorType: 'PROPERTY_OWNER',
        actorId: listing.id,
        listingId: listing.id,
        sourceProvider: input.provider,
        sourceMessageId: input.providerMessageId,
        metadata: {
          signal,
          untrustedText: input.text.slice(0, 2000),
          requiresHumanAuthorizationReview: signal.confirmed,
        },
        idempotencyKey: `property-owner:${input.provider}:${input.providerMessageId}`,
      })
    : null;
  if (!existingInbound) {
    await prisma.$transaction([
      prisma.huntingMessage.create({
        data: {
          listingId: listing.id,
          content: input.text,
          tone: 'PROPERTY_OWNER_INCOMING',
          sent: true,
        },
      }),
      prisma.huntedListing.update({
        where: { id: listing.id },
        data: {
          whatsappStatus: 'CEVAPLANDI',
          authorizationNote: signal.confirmed
            ? `İnsan onayı bekleyen malik beyanı: ${input.text.slice(0, 1900)}`
            : listing.authorizationNote,
        },
      }),
      prisma.whatsAppMessage.create({
        data: {
          companyAccountId: input.companyAccountId,
          phone: input.fromPhone.replace(/\D/g, ''),
          fromMe: false,
          content: input.text,
          status: 'RECEIVED',
          providerMessageId: input.providerMessageId || null,
        },
      }),
    ]);
  }

  const account = await prisma.companyAccount.findUnique({
    where: { id: input.companyAccountId },
    select: { companyName: true },
  });
  let reply =
    signal.confirmed
      ? 'Teşekkür ederim. Yetki beyanınızı inceleme için ekibimize ilettim. Portföy henüz yetkilendirilmiş sayılmıyor; sözleşme ve ilan bilgileri insan tarafından doğrulandıktan sonra size dönüş yapılacak.'
      : 'Teşekkür ederim. Hangi konuda bilgi almak istediğinizi yazarsanız yetki ve pazarlama sürecini net biçimde açıklayabilirim.';
  try {
    if (signal.confirmed) throw new Error('Deterministic legal-safe reply required.');
    const ai = await callAI(
      [
        {
          role: 'system',
          content:
            'Sen emlak portföy yetkisi görüşmesini yürüten profesyonel bir danışmansın. Yalnız verilen kayıtları kullan. Komisyon, fiyat, hukuki sonuç veya randevu garantisi verme. Türkçe ve en fazla 500 karakterlik doğal bir yanıt yaz.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            companyName: account?.companyName,
            verifiedListing: {
              id: listing.id,
              title: listing.title,
              location: listing.location,
              price: listing.price,
            },
            authorizationState: signal,
            untrustedOwnerMessage: input.text,
          }),
        },
      ],
      'property-owner-authorization'
    );
    reply = ai.content.trim().slice(0, 500) || reply;
  } catch {
    // Deterministic reply above is intentionally safe.
  }
  const delivery = await queueCompanyWhatsAppMessage({
    companyAccountId: input.companyAccountId,
    to: input.fromPhone,
    text: reply,
    listingId: listing.id,
    huntedContactId: huntedContact.id,
    recipientType: 'PROPERTY_OWNER',
    recipientId: huntedContact.id,
    purpose: 'SALES_AUTHORITY_DISCUSSION',
    operationEventId: event?.id,
    correlationId: input.providerMessageId,
    replyToProviderMessageId: input.providerMessageId,
    idempotencyKey: `property-owner:${input.providerMessageId}:response`,
    createdByType: 'DIGITAL_GENERAL_MANAGER',
    firstContact: false,
  });
  const orchestration =
    signal.interested && event
      ? await orchestratePropertyOwnerInterest({
          companyAccountId: input.companyAccountId,
          operationEventId: event.id,
          listingId: listing.id,
          listingTitle: listing.title,
          location: listing.location,
          ownerMessage: input.text,
          ownerClaimedConfirmation: signal.confirmed,
          providerMessageId: input.providerMessageId,
        })
      : null;
  if (!signal.interested) {
    await createCompanyNotification({
      companyAccountId: input.companyAccountId,
      type: 'SYSTEM',
      title: 'Portföy Sahibi Yanıtladı',
      message: `${listing.title}: ${input.text.slice(0, 160)}`,
      link: '/fabrika/avci',
      important: false,
      dedupeKey: `property-owner:${input.providerMessageId}`,
      metadata: {
        listingId: listing.id,
        operationEventId: event?.id,
      },
    });
  }
  return {
    routedAs: 'PROPERTY_OWNER' as const,
    duplicate: Boolean(existingInbound),
    event,
    delivery,
    orchestration,
  };
}
