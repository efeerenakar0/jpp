import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HuntJobPanel from './HuntJobPanel';

describe('HuntJobPanel', () => {
  it('bağlantı istemeden sahibinden filtrelerini gösterir', () => {
    const markup = renderToStaticMarkup(
      <HuntJobPanel onJobChange={vi.fn()} onJobFinished={vi.fn()} />
    );

    expect(markup).toContain('Kimden: Sahibinden');
    expect(markup).toContain('Eşya durumu');
    expect(markup).toContain('İl seçin');
    expect(markup).toContain('İlçe seçin');
    expect(markup).not.toContain('Sahibinden bağlantısı');
    expect(markup).not.toContain('type="url"');
  });
});
