import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  requirePolicy: vi.fn(),
  whatsAppFindFirst: vi.fn(),
  whatsAppCreate: vi.fn(),
  whatsAppUpdate: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  conversationMessageCreate: vi.fn(),
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
    whatsAppMessage: {
      findFirst: mocks.whatsAppFindFirst,
      create: mocks.whatsAppCreate,
      update: mocks.whatsAppUpdate,
    },
    customerConversation: {
      findFirst: mocks.conversationFindFirst,
      create: mocks.conversationCreate,
    },
    conversationMessage: { create: mocks.conversationMessageCreate },
  },
}));

import { POST } from './route';
import { ContactPolicyDeniedError } from '@/lib/hunting-v2/contact-service';

describe('Avcı WhatsApp gönderim politika entegrasyonu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.whatsAppFindFirst.mockResolvedValue(null);
    mocks.conversationFindFirst.mockResolvedValue({
      id: 'conversation-a',
    });
    mocks.queue.mockResolvedValue({
      queued: true,
      deliveryStatus: 'QUEUED',
      providerMessageId: 'queue:outbox-a',
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
      })
    );
  });
});
