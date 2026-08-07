import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BUSINESS_CEO_MODULES } from '@/lib/business-ceo-dashboard';

import { BusinessCeoDashboardView } from './BusinessCeoDashboardView';

const noOp = vi.fn();

describe('BusinessCeoDashboardView', () => {
  it('keeps the requested workflow and secondary module order', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        appointments={[]}
        conversations={[]}
        error={null}
        isOwner
        loading={false}
        metrics={null}
        onRefresh={noOp}
        onSendMessage={async () => undefined}
        whatsappStatus={null}
      />
    );

    let cursor = -1;
    for (const definition of [
      ...BUSINESS_CEO_MODULES.workflow,
      ...BUSINESS_CEO_MODULES.secondary,
    ]) {
      const next = html.indexOf(definition.title);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(html).toContain('Henüz gerçek müşteri konuşması yok');
    expect(html).toContain('Hızlı akışı başlat');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-labelledby="business-ceo-workflow-title"');
    expect(html).toContain('aria-labelledby="business-ceo-sales-title"');
    expect(html).toContain('<dl class=');
    for (const definition of BUSINESS_CEO_MODULES.secondary) {
      expect(html).toContain(
        `aria-label="${definition.title} ayrıntılarını aç"`
      );
      expect(html).not.toContain(`href="${definition.href}"`);
    }
  });

  it('renders real conversation content and owner WhatsApp action', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        appointments={[]}
        conversations={[
          {
            id: 'conversation-1',
            customerName: 'Gerçek Müşteri',
            customerPhone: '+905551112233',
            intent: 'RESIDENTIAL',
            summary: null,
            updatedAt: '2026-08-05T12:00:00.000Z',
            messages: [
              {
                id: 'message-1',
                role: 'customer',
                content: 'Portföyü bugün görebilir miyim?',
                createdAt: '2026-08-05T12:00:00.000Z',
                readAt: null,
              },
            ],
          },
        ]}
        error={null}
        isOwner
        loading={false}
        metrics={{
          activeConversations: 1,
          handoffConversations: 0,
          todayMessages: 1,
          incomingMessages: 1,
          outgoingMessages: 0,
          deliveredMessages: 0,
          failedMessages: 0,
          pendingAppointments: 0,
          approvedToday: 0,
        }}
        onRefresh={noOp}
        onSendMessage={async () => undefined}
        whatsappStatus={{
          provider: 'WAHA',
          configured: true,
          connectionStatus: 'CONNECTED',
          connectedPhone: '+905559998877',
          connectedProfileName: 'Ofis',
          lastConnectedAt: '2026-08-05T10:00:00.000Z',
          lastHealthCheckAt: '2026-08-05T12:00:00.000Z',
          lastError: null,
          platformEnabled: true,
          autoReplyEnabled: true,
          allowFirstContact: false,
          dailyMessageLimit: 80,
        }}
      />
    );

    expect(html).toContain('Gerçek Müşteri');
    expect(html).toContain('Portföyü bugün görebilir miyim?');
    expect(html).toContain('WhatsApp Bağlı');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="list"');
    expect(html).toContain('role="listitem"');
  });

  it('does not expose WhatsApp connection controls to employees', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        appointments={[]}
        conversations={[]}
        error={null}
        isOwner={false}
        loading={false}
        metrics={null}
        onRefresh={noOp}
        onSendMessage={async () => undefined}
        whatsappStatus={null}
      />
    );

    expect(html).not.toContain('WhatsApp Bağla');
    expect(html).not.toContain('WhatsApp Bağlı');
  });

  it('does not present a WhatsApp service error as a disconnected account', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        appointments={[]}
        conversations={[]}
        error={null}
        isOwner
        loading={false}
        metrics={null}
        onRefresh={noOp}
        onSendMessage={async () => undefined}
        whatsappError="WhatsApp durumu alınamadı."
        whatsappStatus={null}
      />
    );

    expect(html).toContain('WhatsApp durumunu kontrol et');
    expect(html).toContain('WhatsApp bağlantı durumu kontrol edilemedi');
    expect(html).not.toContain('>WhatsApp Bağla<');
  });

  it('exposes a retry action when live data cannot be loaded', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        appointments={[]}
        conversations={[]}
        error="Canlı veriler alınamadı."
        isOwner
        loading={false}
        metrics={null}
        onRefresh={noOp}
        onSendMessage={async () => undefined}
        whatsappStatus={null}
      />
    );

    expect(html).toContain('Canlı veriler alınamadı.');
    expect(html).toContain('Yeniden dene');
  });
});
