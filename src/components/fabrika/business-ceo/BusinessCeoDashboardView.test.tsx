import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BusinessCeoDashboardView } from './BusinessCeoDashboardView';

const noOp = vi.fn();
const baseProps = {
  appointments: [],
  conversations: [],
  error: null,
  isOwner: true,
  loading: false,
  metrics: null,
  onDeleteConversation: async () => undefined,
  onRefresh: noOp,
  onSendMessage: async () => undefined,
  whatsappStatus: null,
} as const;

describe('BusinessCeoDashboardView', () => {
  it('renders the approved ten-module order and working destinations', () => {
    const html = renderToStaticMarkup(<BusinessCeoDashboardView {...baseProps} />);
    const expected = [
      ['AI Portföy Uzmanı', '/fabrika/avci'],
      ['AI Foto Stüdyo', '/fabrika/studyo?area=enhancer'],
      ['AI Reklam Tasarımı', '/fabrika/reklam-tasarimi'],
      ['AI Pazarlama Marketing', '/fabrika/pazarlamaci'],
      ['AI Satış Asistanı', '/fabrika/asistan'],
      ['AI Yazılımcı', '/fabrika/yazilimci'],
      ['AI Yurt İçi Yurt Dışı Partner Bulucu', '/fabrika/partnerler'],
      ['AI Yetkili Gayrimenkul Havuzu', '/fabrika/yetkili-havuz'],
      ['AI Tapu Takip Uzmanı', '/fabrika/tapu-takip'],
      ['AI Şirket CEO', '/fabrika/crm?view=company-ceo'],
    ] as const;

    let cursor = -1;
    for (const [title, href] of expected) {
      const next = html.indexOf(title);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
      expect(html).toContain(`href="${href.replace('&', '&amp;')}"`);
    }
    expect(html.match(/Paneli Aç/g)).toHaveLength(10);
    expect(html).toContain('aria-label="Yapay zekâ uzmanları"');
    expect(html).toContain('portfolio-transparent.png');
    expect(html).toContain('ceo-transparent.png');
    expect(html).not.toContain('.webp');
  });

  it('shows real dashboard totals without invented values', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView
        {...baseProps}
        huntedPortfolioCount={3486}
        metrics={{
          totalConversations: 1248,
          activeConversations: 642,
          handoffConversations: 0,
          todayMessages: 248,
          incomingMessages: 248,
          outgoingMessages: 0,
          deliveredMessages: 0,
          failedMessages: 0,
          pendingAppointments: 18,
          approvedToday: 0,
        }}
      />
    );

    expect(html).toContain('Toplam İletişime Geçen Müşteri');
    expect(html).toContain('1.248');
    expect(html).toContain('Gelen Mesajlar');
    expect(html).toContain('248');
    expect(html).toContain('Gelen Randevu Talepleri');
    expect(html).toContain('18');
    expect(html).toContain('3.486');
  });

  it('renders the approved references area and enlarged card descriptions', () => {
    const html = renderToStaticMarkup(<BusinessCeoDashboardView {...baseProps} />);

    expect(html).toContain('id="references-title"');
    expect(html).toContain('Müşteri deneyimleri ve tamamlanan işlemlerden geri bildirimler.');
    expect(html).toContain('Portföy toplama, analiz etme ve yönetme uzmanı');
    expect(html).toContain('Profesyonel emlak fotoğraflarını hazırlayın ve iyileştirin.');
    expect(html).toContain('5 üzerinden 5 yıldız');
  });

  it('exposes a retry action when dashboard data cannot be loaded', () => {
    const html = renderToStaticMarkup(
      <BusinessCeoDashboardView {...baseProps} error="Canlı veriler alınamadı." />
    );

    expect(html).toContain('Canlı veriler alınamadı.');
    expect(html).toContain('Yeniden dene');
    expect(html).toContain('role="alert"');
  });
});
