import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callAI: vi.fn(),
  queue: vi.fn(),
  notify: vi.fn(),
  phoneHmac: vi.fn(),
  recordEvent: vi.fn(),
  orchestrate: vi.fn(),
  whatsAppFindFirst: vi.fn(),
  listingFindFirst: vi.fn(),
  contactFindFirst: vi.fn(),
  huntingMessageCreate: vi.fn(),
  listingUpdate: vi.fn(),
  whatsAppCreate: vi.fn(),
  accountFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({ callAI: mocks.callAI }));
vi.mock('@/lib/company-whatsapp', () => ({
  queueCompanyWhatsAppMessage: mocks.queue,
}));
vi.mock('@/lib/fabrika-notifications', () => ({
  createCompanyNotification: mocks.notify,
}));
vi.mock('@/lib/hunting-v2/contact-crypto', () => ({
  phoneHmac: mocks.phoneHmac,
}));
vi.mock('./events', () => ({ recordOperationEvent: mocks.recordEvent }));
vi.mock('./lead-orchestration', () => ({
  orchestratePropertyOwnerInterest: mocks.orchestrate,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppMessage: {
      findFirst: mocks.whatsAppFindFirst,
      create: mocks.whatsAppCreate,
    },
    huntedListing: {
      findFirst: mocks.listingFindFirst,
      update: mocks.listingUpdate,
    },
    huntedContact: { findFirst: mocks.contactFindFirst },
    huntingMessage: { create: mocks.huntingMessageCreate },
    companyAccount: { findUnique: mocks.accountFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { processVerifiedPropertyOwnerWhatsAppMessage } from './property-owner-message';

describe('processVerifiedPropertyOwnerWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.phoneHmac.mockReturnValue('phone-hmac');
    mocks.whatsAppFindFirst.mockResolvedValue(null);
    mocks.listingFindFirst.mockResolvedValue({
      id: 'listing-a',
      title: 'Oba 2+1',
      location: 'Alanya / Oba',
      price: 5_000_000,
      authorizationNote: null,
    });
    mocks.contactFindFirst.mockResolvedValue({ id: 'hunted-contact-a' });
    mocks.transaction.mockResolvedValue([]);
    mocks.accountFindUnique.mockResolvedValue({ companyName: 'Örnek Emlak' });
    mocks.callAI.mockResolvedValue({ content: 'Detayları paylaşabilirim.' });
    mocks.queue.mockResolvedValue({
      outboxId: 'outbox-a',
      deliveryStatus: 'QUEUED',
    });
    mocks.recordEvent.mockResolvedValue({ id: 'event-a' });
    mocks.orchestrate.mockResolvedValue({ taskId: 'task-a' });
  });

  it('malik yanıtını aynı tenant ve ilan için doğrulanmış kişi kaydına bağlar', async () => {
    await processVerifiedPropertyOwnerWhatsAppMessage({
      companyAccountId: 'company-a',
      listingId: 'listing-a',
      text: 'Yetki şartlarını görüşelim',
      provider: 'WAHA',
      providerMessageId: 'provider-in-a',
      fromPhone: '+90 500 111 22 33',
    });

    expect(mocks.contactFindFirst).toHaveBeenCalledWith({
      where: {
        companyAccountId: 'company-a',
        listingId: 'listing-a',
        phoneHmac: 'phone-hmac',
      },
      select: { id: true },
    });
    expect(mocks.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        listingId: 'listing-a',
        huntedContactId: 'hunted-contact-a',
        recipientType: 'PROPERTY_OWNER',
        recipientId: 'hunted-contact-a',
        purpose: 'SALES_AUTHORITY_DISCUSSION',
        firstContact: false,
      })
    );
  });

  it('telefon başka veya belirsiz kişi kaydına aitse hiçbir yanıt kuyruğu oluşturmaz', async () => {
    mocks.contactFindFirst.mockResolvedValue(null);

    await expect(
      processVerifiedPropertyOwnerWhatsAppMessage({
        companyAccountId: 'company-a',
        listingId: 'listing-a',
        text: 'Detay alabilir miyim?',
        provider: 'WAHA',
        providerMessageId: 'provider-in-b',
        fromPhone: '+90 500 999 88 77',
      })
    ).rejects.toThrow('doğrulanmış ve bu şirkete ait iletişim kaydı');

    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
