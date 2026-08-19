import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ChatInterface from './ChatInterface';

const baseProps = {
  conversationId: 'conversation-1',
  onSendMessage: vi.fn(async () => undefined),
  onUpdateConversation: vi.fn(async () => undefined),
  onDeleteConversation: vi.fn(),
  onOpenCustomerDetails: vi.fn(),
  customerName: 'Efe Yılmaz',
  intent: 'INVESTMENT',
  notes: 'Alanya bölgesiyle ilgileniyor.',
  tags: ['Sıcak müşteri'],
  aiEnabled: true,
  lastCustomerMessageAt: null,
};

describe('ChatInterface', () => {
  it('renders incoming and outgoing WhatsApp messages with delivery state and accessible actions', () => {
    const html = renderToStaticMarkup(
      <ChatInterface
        {...baseProps}
        messages={[
          {
            id: 'incoming-1',
            role: 'user',
            content: 'Ofisinizin adresi nerede?',
            createdAt: '2026-08-19T08:24:00.000Z',
          },
          {
            id: 'outgoing-1',
            role: 'patron',
            content: 'Konum bilgisini hemen paylaşayım.',
            createdAt: '2026-08-19T08:25:00.000Z',
            deliveryStatus: 'DELIVERED',
          },
        ]}
      />,
    );

    expect(html).toContain('aria-label="Efe Yılmaz sohbeti"');
    expect(html).toContain('Ofisinizin adresi nerede?');
    expect(html).toContain('Konum bilgisini hemen paylaşayım.');
    expect(html).toContain('Teslim');
    expect(html).toContain('Müşteri bilgileri');
    expect(html).toContain('aria-label="Sohbeti arşivle"');
    expect(html).toContain('placeholder="Mesaj yazın…"');
    expect(html).toContain('aria-label="Mesajı gönder"');
  });

  it('keeps the empty conversation ready for the first manual message', () => {
    const html = renderToStaticMarkup(<ChatInterface {...baseProps} messages={[]} />);

    expect(html).toContain('Henüz mesaj yok');
    expect(html).toContain('İlk mesajı aşağıdaki alandan gönderebilirsiniz.');
    expect(html).toContain('AI Devrede');
  });
});
