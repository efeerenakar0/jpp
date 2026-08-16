import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StudioPage from './page';

describe('StudioPage ilk kullanım akışı', () => {
  it('header üretmeden portföy, sürükle-bırak ve geçmiş çalışma alanlarını gösterir', () => {
    const html = renderToStaticMarkup(<StudioPage />);

    expect(html).toContain('Portföyden Seç');
    expect(html).toContain('DOSYAYI BURAYA');
    expect(html).toContain('SÜRÜKLE');
    expect(html).toContain('Geçmiş Çalışmalarım');
    expect(html).toContain('Bilgisayarınızdan');
    expect(html).toContain('Portföyünüzden');
    expect(html).not.toContain('İyileştirme yöntemi');
    expect(html).not.toContain('GPT Image 2');
    expect(html).not.toContain('FLUX.2 Klein 4B');
    expect(html).not.toContain('AI FOTOĞRAF STÜDYOSU');
    expect(html).not.toContain('HDR Geliştirme');
  });
});
