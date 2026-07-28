import { describe, expect, it } from 'vitest';
import {
  INTERNATIONAL_MARKETS,
  buildInternationalFallback,
  parseInternationalPlan,
} from './international-marketing';

const property = {
  id: 'property-1',
  title: 'Deniz Manzaralı 3+1 Daire',
  location: 'Alanya, Kestel',
  price: 8_500_000,
  roomCount: '3+1',
  area: 165,
  description: 'Geniş balkonlu daire.',
  imageUrl: 'https://example.com/property.jpg',
  referenceCode: 'JG-101',
};

describe('international marketing', () => {
  it('offers every requested country with safe publishing and pricing links', () => {
    expect(INTERNATIONAL_MARKETS).toHaveLength(15);
    expect(INTERNATIONAL_MARKETS.map((market) => market.code)).toEqual([
      'DE',
      'GB',
      'ES',
      'FR',
      'IT',
      'PT',
      'NL',
      'AE',
      'US',
      'CA',
      'AU',
      'CH',
      'AT',
      'BE',
      'GR',
    ]);
    expect(
      INTERNATIONAL_MARKETS.every((market) =>
        market.portals.every(
          (portal) =>
            portal.publishUrl.startsWith('https://') &&
            portal.pricingUrl.startsWith('https://')
        )
      )
    ).toBe(true);
  });

  it('creates a complete fallback package from verified property data', () => {
    const germany = INTERNATIONAL_MARKETS[0];
    const plan = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
    });

    expect(plan.countryCode).toBe('DE');
    expect(plan.portalCopies).toHaveLength(germany.portals.length);
    expect(plan.portalCopies.every((copy) => copy.body.includes('Alanya, Kestel'))).toBe(
      true
    );
    expect(plan.portalCopies.every((copy) => copy.body.includes('3+1'))).toBe(true);
    expect(plan.portalCopies.every((copy) => copy.body.includes('165 m²'))).toBe(true);
  });

  it('accepts AI copy only for known portals and preserves verified links', () => {
    const germany = INTERNATIONAL_MARKETS[0];
    const fallback = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
    });
    const parsed = parseInternationalPlan(
      JSON.stringify({
        countryCode: 'DE',
        strategy: 'Almanya odaklı doğrulanmış plan',
        portalCopies: [
          {
            portalId: 'kleinanzeigen',
            title: 'Wohnung mit Meerblick in Alanya',
            body: 'Gerçek portföy bilgileriyle Almanca metin.',
            steps: ['Hesabınıza giriş yapın', 'Immobilien kategorisini seçin'],
            publishUrl: 'https://malicious.example',
          },
          {
            portalId: 'unknown-portal',
            title: 'Bilinmeyen',
            body: 'Kullanılmamalı',
          },
        ],
      }),
      fallback,
      germany
    );

    const kleinanzeigen = parsed.portalCopies.find(
      (copy) => copy.portalId === 'kleinanzeigen'
    );
    expect(parsed.portalCopies).toHaveLength(germany.portals.length);
    expect(kleinanzeigen?.title).toBe('Wohnung mit Meerblick in Alanya');
    expect(kleinanzeigen?.publishUrl).toBe(
      germany.portals.find((portal) => portal.id === 'kleinanzeigen')?.publishUrl
    );
    expect(parsed.portalCopies.some((copy) => copy.portalId === 'unknown-portal')).toBe(
      false
    );
  });
});
