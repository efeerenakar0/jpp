import { describe, expect, it } from 'vitest';
import {
  buildSahibindenSearchUrl,
  sahibindenSearchFiltersSchema,
} from './search-filters';

describe('Business AI Portföy Uzmanı filtre bağlantısı', () => {
  it('il, ilçe ve mahalleden yalnız sahibinden emlak ilanlarını hedefleyen URL üretir', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caddebostan',
        propertyType: 'KONUT',
      })
    ).toBe(
      'https://www.sahibinden.com/emlak-konut/istanbul-kadikoy-caddebostan?a27=38460&sorting=date_desc'
    );
  });

  it('Türkçe konum adlarını güvenli URL parçalarına dönüştürür', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'Muğla',
        district: 'Bodrum',
        neighborhood: 'Gümüşlük',
        propertyType: 'TURISTIK_TESIS',
      })
    ).toContain(
      '/emlak-turistik-tesis/mugla-bodrum-gumusluk?a27=38460&'
    );
  });

  it('konut projelerini proje kaynağına yönlendirir', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caddebostan',
        propertyType: 'KONUT_PROJELERI',
      })
    ).toBe(
      'https://www.sahibinden.com/emlak-projeler/istanbul-kadikoy-caddebostan?sorting=date_desc'
    );
  });

  it('site kategori yollarını güncel Sahibinden yollarıyla eşler', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'Antalya',
        district: 'Alanya',
        neighborhood: 'Oba',
        propertyType: 'DEVREN_MULK',
      })
    ).toContain('/devre-mulk/antalya-alanya-oba?');
  });

  it('serbest URL ve eksik mahalle kabul etmez', () => {
    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        province: 'https://evil.example',
        district: 'Kadıköy',
        neighborhood: 'Caddebostan',
        propertyType: 'KONUT',
      })
    ).toThrow();

    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        province: 'İstanbul',
        district: 'Kadıköy',
      })
    ).toThrow();
  });
});
