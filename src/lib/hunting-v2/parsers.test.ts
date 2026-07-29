import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectSourceChallenge,
  parseListingDetailHtml,
  parseSearchResultsHtml,
} from './parsers';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('Avcı v2 HTML parserları', () => {
  it('LIST sonuçlarını ilan numarasıyla tekilleştirir ve sonraki sayfayı bulur', () => {
    const result = parseSearchResultsHtml(
      fixture('search-results.html'),
      'https://www.sahibinden.com/satilik'
    );

    expect(result.listings).toHaveLength(2);
    expect(result.listings.map((item) => item.sourceListingId)).toEqual([
      'fixture-1001',
      'fixture-1002',
    ]);
    expect(result.nextPageUrl).toBe(
      'https://www.sahibinden.com/satilik?pagingOffset=20'
    );
  });

  it('DETAIL içeriğini yapılandırır, medyayı sıralar ve telefonu çıkarmaz', () => {
    const result = parseListingDetailHtml(
      fixture('listing-detail.html'),
      'https://www.sahibinden.com/ilan/emlak-konut-satilik-fixture-villa-1001/detay'
    );

    expect(result.sourceListingId).toBe('fixture-1001');
    expect(result.priceAmount).toBe(12_500_000);
    expect(result.currency).toBe('TRY');
    expect(result.province).toBe('Antalya');
    expect(result.district).toBe('Alanya');
    expect(result.neighborhood).toBe('Kestel');
    expect(result.street).toBe('Sahil Cd.');
    expect(result.addressPrecision).toBe('EXACT');
    expect(result.attributes).toMatchObject({
      'Oda Sayısı': '4+1',
      'm² (Brüt)': '240',
    });
    expect(result.images.map((image) => image.sourceUrl)).toEqual([
      'https://images.example.test/villa-1.jpg',
      'https://images.example.test/villa-2.jpg',
    ]);
    expect(JSON.stringify(result)).not.toContain('05000000000');
    expect(result.sanitizedDescriptionHtml).not.toContain('<script');
    expect(result.sanitizedDescriptionHtml).not.toContain('javascript:');
  });

  it('eksik adresi tahmin etmez', () => {
    const result = parseListingDetailHtml(
      '<h1>Eksik konum</h1><div class="classifiedDetailLocation"><a>Antalya</a></div>',
      'https://www.sahibinden.com/ilan/fixture-2001/detay'
    );

    expect(result.province).toBe('Antalya');
    expect(result.district).toBeNull();
    expect(result.neighborhood).toBeNull();
    expect(result.addressPrecision).toBe('CITY');
  });

  it('challenge sayfasını aşmaya çalışmadan işaretler', () => {
    expect(detectSourceChallenge(fixture('challenge.html'))).toBe(true);
    expect(detectSourceChallenge(fixture('listing-detail.html'))).toBe(false);
  });
});
