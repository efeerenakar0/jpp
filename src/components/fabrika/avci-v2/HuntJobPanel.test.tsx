import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HuntJobPanel, { isActiveHuntJob } from './HuntJobPanel';

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
    expect(markup).toContain(
      'Mahalle gelen ilanların kendi adresinde gösterilir.'
    );
    expect(markup).not.toContain('Mahalle seçin');
    expect(markup).toContain('2. Ne tür gayrimenkul arıyorsunuz?');
    expect(markup).toContain('Konut Projeleri');
    expect(markup).toContain('Devren Mülk');
    expect(markup).toContain('Turistik Tesis');
    expect(markup.match(/name="propertyType"/g)).toHaveLength(7);
    expect(markup).toContain(
      'AI portföy uzmanı yeni portföy fırsatlarını keşfeder ve Sizin'
    );
    expect(markup).not.toContain('Bağlantı yapıştır');
    expect(markup).not.toContain('type="url"');
    expect(markup).not.toContain('Her taramada');
    expect(markup).not.toContain('Bu ay');
    expect(markup).not.toContain('Her taramada aynı sıraya takılmaz');
  });

  it('devam eden veya duraklatılmış iş varken ikinci işi aktif sayar', () => {
    expect(isActiveHuntJob('QUEUED')).toBe(true);
    expect(isActiveHuntJob('RUNNING')).toBe(true);
    expect(isActiveHuntJob('PAUSED')).toBe(true);
    expect(isActiveHuntJob('SOURCE_CHALLENGE')).toBe(false);
    expect(isActiveHuntJob('COMPLETED')).toBe(false);
    expect(isActiveHuntJob('FAILED')).toBe(false);
  });
});
