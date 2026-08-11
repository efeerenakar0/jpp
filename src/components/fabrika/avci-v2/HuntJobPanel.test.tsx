import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HuntJobPanel from './HuntJobPanel';

describe('HuntJobPanel', () => {
  it('yalnızca bölge filtreleriyle portföy kaynağını seçtirir', () => {
    const markup = renderToStaticMarkup(
      <HuntJobPanel onJobChange={vi.fn()} onJobFinished={vi.fn()} />
    );

    expect(markup).toContain('Kimden: Sahibinden Satıcılar');
    expect(markup).toContain(
      'Satış yetkisini almak istediğiniz portföyleri belirleyin'
    );
    expect(markup).toContain('İl seçin');
    expect(markup).toContain('İlçe seçin');
    expect(markup).toContain('Mahalle seçin');
    expect(markup).toContain('Gayrimenkul türü');
    expect(markup).toContain('Konut Projeleri');
    expect(markup).toContain('Devren Mülk');
    expect(markup).toContain('Turistik Tesis');
    expect(markup.match(/name="propertyType"/g)).toHaveLength(7);
    expect(markup).toContain(
      'AI Portföy Uzmanı, seçtiğiniz kriterlere uygun potansiyel gayrimenkulleri'
    );
    expect(markup).not.toContain('Bağlantı yapıştır');
    expect(markup).not.toContain('type="url"');
  });
});
