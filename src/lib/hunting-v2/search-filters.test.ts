import { describe, expect, it } from 'vitest';
import {
  buildSahibindenSearchUrl,
  sahibindenSearchFiltersSchema,
} from './search-filters';

describe('Business AI Portföy Uzmanı filtre bağlantısı', () => {
  it('il, ilçe ve konut tipinden yalnız sahibinden ilanlarını hedefleyen URL üretir', () => {
    expect(
      buildSahibindenSearchUrl({
        listingType: 'RENT',
        propertyType: 'APARTMENT',
        province: 'İstanbul',
        district: 'Kadıköy',
        furnished: 'ANY',
        minPrice: null,
        maxPrice: null,
      })
    ).toBe(
      'https://www.sahibinden.com/kiralik-daire/istanbul-kadikoy/sahibinden?sorting=date_desc'
    );
  });

  it('eşyalı ve fiyat seçimlerini kaynak URL parametrelerine güvenli biçimde ekler', () => {
    expect(
      buildSahibindenSearchUrl({
        listingType: 'SALE',
        propertyType: 'VILLA',
        province: 'Muğla',
        district: 'Bodrum',
        furnished: 'YES',
        minPrice: 5_000_000,
        maxPrice: 25_000_000,
      })
    ).toBe(
      'https://www.sahibinden.com/satilik-villa/mugla-bodrum/sahibinden?a103713=true&price_min=5000000&price_max=25000000&sorting=date_desc'
    );
  });

  it('eşyasız seçimini açıkça taşır ve serbest URL/hostname kabul etmez', () => {
    expect(
      buildSahibindenSearchUrl({
        listingType: 'RENT',
        propertyType: 'RESIDENCE',
        province: 'İzmir',
        district: 'Çeşme',
        furnished: 'NO',
        minPrice: null,
        maxPrice: null,
      })
    ).toContain('a103713=false');

    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        listingType: 'RENT',
        propertyType: 'APARTMENT',
        province: 'https://evil.example',
        district: 'Kadıköy',
        furnished: 'ANY',
      })
    ).toThrow();
  });

  it('minimum fiyat maksimum fiyattan büyükse reddeder', () => {
    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        listingType: 'SALE',
        propertyType: 'APARTMENT',
        province: 'Ankara',
        district: 'Çankaya',
        furnished: 'ANY',
        minPrice: 10_000_000,
        maxPrice: 1_000_000,
      })
    ).toThrow();
  });
});
