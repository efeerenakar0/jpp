import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioPage from './page';

describe('StudioPage ilk kullanım akışı', () => {
  it('portföy, görselli sürükle-bırak ve geçmiş çalışma alanlarını gösterir', () => {
    const html = renderToStaticMarkup(<StudioPage />);

    expect(html).toContain('Yeni çalışma');
    expect(html).toContain('Portföyden Seç');
    expect(html).toContain('DOSYAYI BURAYA');
    expect(html).toContain('SÜRÜKLE');
    expect(html).toContain('upload-villa-white-studio.png');
    expect(html).toContain('Geçmiş Çalışmalarım');
    expect(html).toContain('Bilgisayarınızdan');
    expect(html).toContain('Portföyünüzden');
    expect(html).not.toContain('İyileştirme yöntemi');
    expect(html).not.toContain('GPT Image 2');
    expect(html).not.toContain('FLUX.2 Klein 4B');
    expect(html).not.toContain('AI Fotoğraf Stüdyosu');
    expect(html).not.toContain('CREATIVE SUITE');
    expect(html).not.toContain('AI FOTOĞRAF STÜDYOSU');
    expect(html).not.toContain('HDR Geliştirme');
  });
});
