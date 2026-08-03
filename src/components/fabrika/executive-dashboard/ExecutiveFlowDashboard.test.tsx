import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExecutiveFlowDashboard from './ExecutiveFlowDashboard';

describe('ExecutiveFlowDashboard', () => {
  it('shows two entry routes that converge into portfolios and continue in order', () => {
    const html = renderToStaticMarkup(<ExecutiveFlowDashboard />);

    const hunter = html.indexOf('AI Portföy Uzmanı');
    const studio = html.indexOf('AI Stüdyo');
    const portfolios = html.indexOf('Portföyler');
    const advertising = html.indexOf('AI Reklam Tasarımı');
    const marketing = html.indexOf('AI Pazarlama Uzmanı');

    expect(hunter).toBeGreaterThan(-1);
    expect(studio).toBeGreaterThan(-1);
    expect(portfolios).toBeGreaterThan(hunter);
    expect(portfolios).toBeGreaterThan(studio);
    expect(advertising).toBeGreaterThan(portfolios);
    expect(marketing).toBeGreaterThan(advertising);
    expect(html).toContain('Bulunan portföy');
    expect(html).toContain('Yeni portföy');
  });

  it('keeps the seven shortcuts, assistant command area and one help control per module', () => {
    const html = renderToStaticMarkup(<ExecutiveFlowDashboard />);

    for (const label of [
      'Yazılımcı',
      'Çalışanlar',
      'Takvim',
      'Şirket',
      'Belge',
      'WhatsApp',
      'Asistan',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('GENEL MÜDÜR YARDIMCISI');
    expect(html).toContain('Business CEO AI Asistanı');
    expect(html).toContain('Bir şey yazın...');
    expect(html.match(/data-help-badge="true"/g)).toHaveLength(12);
  });
});
