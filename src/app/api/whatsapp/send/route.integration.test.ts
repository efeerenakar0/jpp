import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  requirePolicy: vi.fn(),
  whatsAppFindFirst: vi.fn(),
  whatsAppFindUnique: vi.fn(),
  whatsAppCreate: vi.fn(),
  whatsAppUpdateMany: vi.fn(),
  whatsAppFindUniqueOrThrow: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  outboxUpdateMany: vi.fn(),
  conversationMessageFindUnique: vi.fn(),
  conversationMessageCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class MockSessionError extends Error {},
  requireFabrikaPrincipal: vi.fn().mockResolvedValue({
    type: 'OWNER',
    member: null,
    account: { id: 'company-a' },
  }),
}));

vi.mock('@/lib/hunting-v2/contact-service', () => ({
  ContactPolicyDeniedError: class ContactPolicyDeniedError extends Error {
    constructor(public readonly reasonCodes: string[]) {
      super('İletişim politikası reddetti.');
    }
  },
  requireContactPolicyApproval: mocks.requirePolicy,
}));

vi.mock('@/lib/company-whatsapp', () => ({
  queueCompanyWhatsAppMessage: mocks.queue,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: mocks.transaction,
    whatsAppMessage: {
      findFirst: mocks.whatsAppFindFirst,
      findUnique: mocks.whatsAppFindUnique,
      create: mocks.whatsAppCreate,
      updateMany: mocks.whatsAppUpdateMany,
      findUniqueOrThrow: mocks.whatsAppFindUniqueOrThrow,
    },
    customerConversation: {
      findFirst: mocks.conversationFindFirst,
      create: mocks.conversationCreate,
    },
    whatsAppOutboxMessage: { updateMany: mocks.outboxUpdateMany },
    conversationMessage: {
      findUnique: mocks.conversationMessageFindUnique,
      create: mocks.conversationMessageCreate,
    },
  },
}));

import { POST } from './route';
import { ContactPolicyDeniedError } from '@/lib/hunting-v2/contact-service';

describe('Avcı WhatsApp gönderim politika entegrasyonu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          whatsAppMessage: {
            findFirst: mocks.whatsAppFindFirst,
            findUnique: mocks.whatsAppFindUnique,
            create: mocks.whatsAppCreate,
            updateMany: mocks.whatsAppUpdateMany,
            findUniqueOrThrow: mocks.whatsAppFindUniqueOrThrow,
          },
          customerConversation: {
            findFirst: mocks.conversationFindFirst,
            create: mocks.conversationCreate,
          },
          whatsAppOutboxMessage: { updateMany: mocks.outboxUpdateMany },
          conversationMessage: {
            findUnique: mocks.conversationMessageFindUnique,
            create: mocks.conversationMessageCreate,
          },
        })
    );
    mocks.whatsAppFindFirst.mockResolvedValue(null);
    mocks.whatsAppFindUnique.mockResolvedValue(null);
    mocks.conversationMessageFindUnique.mockResolvedValue(null);
    mocks.conversationFindFirst.mockResolvedValue({
      id: 'conversation-a',
    });
    mocks.queue.mockResolvedValue({
      queued: true,
      deliveryStatus: 'QUEUED',
      providerMessageId: 'queue:outbox-a',
      outboxId: 'outbox-a',
      conversationId: 'conversation-a',
      toPhone: '905001112233',
      lastError: null,
    });
    mocks.whatsAppCreate.mockResolvedValue({ id: 'message-a' });
    mocks.conversationMessageCreate.mockResolvedValue({
      id: 'conversation-message-a',
    });
  });

  it('contact policy reddederse outbox kuyruğuna hiçbir şey yazmaz', async () => {
    mocks.requirePolicy.mockRejectedValue(
      new ContactPolicyDeniedError(['SUPPRESSED'])
    );
    const response = await POST(
      new Request('https://app.example/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Merhaba',
          requestId: '01941668-8f2d-7c3e-a61b-67759b47e812',
          listingId: 'listing-1',
          huntedContactId: 'contact-1',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'İletişim izinleri gönderime uygun değil.',
      reasonCodes: ['SUPPRESSED'],
    });
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('saklama süresi dolan kişi için kuyruğu fail-closed engeller', async () => {
    mocks.requirePolicy.mockRejectedValue(
      new ContactPolicyDeniedError(['RETENTION_EXPIRED'])
    );
    const response = await POST(
      new Request('https://app.example/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Merhaba',
          requestId: '01941668-8f2d-7c3e-a61b-67759b47e812',
          listingId: 'listing-1',
          huntedContactId: 'contact-1',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('izinli kayıtta telefonu istemciden değil politika sonucundan alıp mocked outbox kuyruğuna yazar', async () => {
    mocks.requirePolicy.mockResolvedValue({
      allowed: true,
      reasonCodes: [],
      phone: '905001112233',
      maskedPhone: '••••2233',
    });
    const response = await POST(
      new Request('https://app.example/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Satış yetkisi görüşmesi için uygun musunuz?',
          requestId: '01941668-8f2d-7c3e-a61b-67759b47e812',
          listingId: 'listing-1',
          huntedContactId: 'contact-1',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        to: '905001112233',
        listingId: 'listing-1',
        huntedContactId: 'contact-1',
        purpose: 'SALES_AUTHORITY_DISCUSSION',
        idempotencyKey:
          'manual-send:01941668-8f2d-7c3e-a61b-67759b47e812',
        deferDispatch: true,
        tx: expect.any(Object),
      })
    );
  });

  it('istemci istek kimliği olmadan manuel gönderimi reddeder', async () => {
    const response = await POST(
      new Request('https://app.example/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '905001112233',
          message: 'Merhaba',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it('aynı istek kimliğinin retryında mevcut yerel kayıtları yeniden kullanır', async () => {
    const existingMessage = {
      id: 'message-a',
      companyAccountId: 'company-a',
      phone: '905001112233',
      fromMe: true,
      content: 'Merhaba',
      providerMessageId: 'queue:outbox-a',
    };
    mocks.whatsAppFindUnique.mockResolvedValue(existingMessage);
    mocks.conversationMessageFindUnique.mockResolvedValue({
      id: 'conversation-message-a',
      conversationId: 'conversation-a',
      content: 'Merhaba',
    });

    const response = await POST(
      new Request('https://app.example/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '905001112233',
          message: 'Merhaba',
          requestId: '01941668-8f2d-7c3e-a61b-67759b47e812',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.whatsAppCreate).not.toHaveBeenCalled();
    expect(mocks.conversationMessageCreate).not.toHaveBeenCalled();
    expect(mocks.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          'manual-send:01941668-8f2d-7c3e-a61b-67759b47e812',
        deferDispatch: true,
      })
    );
  });
});
