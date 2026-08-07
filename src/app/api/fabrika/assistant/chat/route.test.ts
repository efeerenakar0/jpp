import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  sendMessage: vi.fn(),
  saveMessage: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    customerConversation: {
      findFirst: mocks.conversationFindFirst,
      update: mocks.conversationUpdate,
    },
  },
}));

vi.mock('@/lib/assistant-messaging', () => ({
  sendAssistantWhatsAppMessage: mocks.sendMessage,
  saveOutgoingConversationMessage: mocks.saveMessage,
}));

import { POST } from './route';

function request(clientRequestId: string, message = 'Merhaba') {
  return new Request('https://app.test/api/fabrika/assistant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId: 'conversation-a',
      message,
      clientRequestId,
    }),
  });
}

describe('POST /api/fabrika/assistant/chat idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.conversationFindFirst.mockResolvedValue({
      id: 'conversation-a',
      companyAccountId: 'company-a',
      customerPhone: '905551112233',
      lastCustomerMessageAt: new Date('2026-08-07T03:00:00.000Z'),
      messages: [],
    });
    mocks.sendMessage.mockResolvedValue({
      providerMessageId: 'provider-message-a',
      deliveryStatus: 'QUEUED',
      messageType: 'TEXT',
      metadata: '{}',
    });
    mocks.saveMessage.mockResolvedValue({
      id: 'message-a',
      role: 'patron',
      content: 'Merhaba',
      createdAt: '2026-08-07T03:01:00.000Z',
    });
    mocks.conversationUpdate.mockResolvedValue({ id: 'conversation-a' });
  });

  it('binds one browser submission to a stable tenant and conversation scoped key', async () => {
    const response = await POST(request('request-00000001'));

    expect(response.status).toBe(200);
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        conversationId: 'conversation-a',
        idempotencyKey:
          'assistant-chat:company-a:conversation-a:request-00000001',
      })
    );
  });

  it('uses a different outbox key for a different manual message submission', async () => {
    await POST(request('request-00000001', 'Birinci mesaj'));
    await POST(request('request-00000002', 'İkinci mesaj'));

    expect(mocks.sendMessage.mock.calls[0]?.[0].idempotencyKey).not.toBe(
      mocks.sendMessage.mock.calls[1]?.[0].idempotencyKey
    );
  });
});
