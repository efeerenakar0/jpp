import { describe, expect, it } from 'vitest';
import {
  buildSahibindenSearchUrl,
  sahibindenSearchFiltersSchema,
} from './search-filters';

describe('Business AI Portfoy Uzmani filtre baglantisi', () => {
  it('il ve ilceden yalniz sahibinden emlak ilanlarini hedefler', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'Istanbul',
        district: 'Kadikoy',
        propertyType: 'KONUT',
      })
    ).toBe(
      'https://www.sahibinden.com/emlak-konut/istanbul-kadikoy/sahibinden?a27=38460&sorting=date_desc'
    );
  });

  it('Turkce konum adlarini guvenli URL parcalarina donusturur', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'Mugla',
        district: 'Bodrum',
        propertyType: 'TURISTIK_TESIS',
      })
    ).toContain(
      '/emlak-turistik-tesis/mugla-bodrum/sahibinden?a27=38460&'
    );
  });

  it('desteklenen sıralamaları aynı owner-only URL üzerinde güvenli uygular', () => {
    const filters = {
      province: 'Antalya',
      district: 'Alanya',
      propertyType: 'KONUT' as const,
    };
    expect(
      buildSahibindenSearchUrl(filters, { id: 'OLDEST', sorting: 'date_asc' })
    ).toContain('sorting=date_asc');
    expect(
      buildSahibindenSearchUrl(filters, {
        id: 'PRICE_ASC',
        sorting: 'price_asc',
      })
    ).toContain('sorting=price_asc');
    expect(
      buildSahibindenSearchUrl(filters, { id: 'RECOMMENDED', sorting: null })
    ).not.toContain('sorting=');
  });

  it('owner-only kaniti olmayan konut projelerinde fail-closed davranir', () => {
    expect(() =>
      buildSahibindenSearchUrl({
        province: 'Istanbul',
        district: 'Kadikoy',
        propertyType: 'KONUT_PROJELERI',
      })
    ).toThrow('bireysel sahibinden ilani dogrulanamadigi');
  });

  it('site kategori yollarini guncel Sahibinden yollarina esler', () => {
    expect(
      buildSahibindenSearchUrl({
        province: 'Antalya',
        district: 'Alanya',
        propertyType: 'DEVREN_MULK',
      })
    ).toContain('/devre-mulk/antalya-alanya/sahibinden?');
  });

  it('serbest URL ve eksik ilce kabul etmez', () => {
    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        province: 'https://evil.example',
        district: 'Kadikoy',
        propertyType: 'KONUT',
      })
    ).toThrow();
    expect(() =>
      sahibindenSearchFiltersSchema.parse({
        province: 'Istanbul',
        district: 'Kadikoy',
      })
    ).toThrow();
  });
});
