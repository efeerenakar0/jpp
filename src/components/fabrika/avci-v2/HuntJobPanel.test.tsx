import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HuntJobPanel from './HuntJobPanel';

describe('HuntJobPanel', () => {
  it('filtre ve doğrudan bağlantı seçeneklerini birlikte gösterir', () => {
    const markup = renderToStaticMarkup(
      <HuntJobPanel onJobChange={vi.fn()} onJobFinished={vi.fn()} />
    );

    expect(markup).toContain('Filtreleri seç');
    expect(markup).toContain('Bağlantı yapıştır');
    expect(markup).toContain('Kimden: Sahibinden');
    expect(markup).toContain('Eşya durumu');
    expect(markup).toContain('İl seçin');
    expect(markup).toContain('İlçe seçin');
    expect(markup).toContain('Sahibinden bağlantısı');
    expect(markup).toContain('type="url"');
  });
});
