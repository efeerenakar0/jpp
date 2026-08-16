import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  HuntCategoryPicker,
  mergeHuntQuota,
  normalizeHuntPropertyType,
  normalizeHuntQuotaResponse,
  normalizeHuntQuotaSnapshot,
} from './HuntQuotaGuide';

describe('HuntQuotaGuide', () => {
  it('kategori seçimini kota ayrıntılarıyla kalabalıklaştırmadan gösterir', () => {
    const quotas = normalizeHuntQuotaResponse({
      items: [
        {
          propertyType: 'KONUT',
          perRunLimit: 50,
          monthlyLimit: 500,
          used: 80,
          remaining: 420,
        },
      ],
    });
    const markup = renderToStaticMarkup(
      <HuntCategoryPicker
        onSelect={vi.fn()}
        quotas={quotas}
        selected="KONUT"
      />
    );

    expect(markup).not.toContain('Her taramada');
    expect(markup).not.toContain('Bu ay');
    expect(markup).not.toContain('Aylık limit');
    expect(markup).toContain(
      'Yalnız bireysel ilan kaynağı doğrulanamadığı için kapalı'
    );
    expect(markup).toContain('disabled="" type="radio" name="propertyType" value="KONUT_PROJELERI"');
    expect(markup).not.toContain('role="progressbar"');
  });

  it('eski ve yeni API alan adlarını aynı kota görünümüne dönüştürür', () => {
    const quotas = normalizeHuntQuotaResponse({
      data: {
        quotas: [
          {
            category: 'İşyeri',
            perClickLimit: '5',
            limitPerMonth: '15',
            consumed: '10',
          },
        ],
      },
    });
    const office = quotas.find((quota) => quota.propertyType === 'ISYERI');

    expect(normalizeHuntPropertyType('İşyeri')).toBe('ISYERI');
    expect(office).toMatchObject({
      perRunLimit: 5,
      monthlyLimit: 15,
      used: 10,
      remaining: 5,
    });
  });

  it('iş cevabındaki kota anlık görüntüsünü mevcut listeyle birleştirir', () => {
    const current = normalizeHuntQuotaResponse(null);
    const snapshot = normalizeHuntQuotaSnapshot({
      propertyType: 'ARSA',
      quota: {
        runLimit: 5,
        monthLimit: 15,
        monthlyRemaining: 10,
      },
    });
    const merged = mergeHuntQuota(current, snapshot);

    expect(merged.find((quota) => quota.propertyType === 'ARSA')).toMatchObject({
      perRunLimit: 5,
      monthlyLimit: 15,
      used: 5,
      remaining: 10,
    });
  });
});
