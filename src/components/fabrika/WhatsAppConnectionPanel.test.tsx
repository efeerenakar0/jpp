import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WhatsAppConnectionPanel from './WhatsAppConnectionPanel';

describe('WhatsAppConnectionPanel compact mode', () => {
  it('renders a live WAHA status surface for the conversations sidebar', () => {
    const html = renderToStaticMarkup(<WhatsAppConnectionPanel compact />);

    expect(html).toContain('aria-label="WAHA bağlantısı"');
    expect(html).toContain('WAHA bağlantısı');
    expect(html).toContain('WhatsApp şirket hattı');
    expect(html).toContain('Kontrol ediliyor');
  });
});
