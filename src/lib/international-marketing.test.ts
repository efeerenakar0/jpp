import { describe, expect, it } from 'vitest';
import {
  INTERNATIONAL_MARKETS,
  buildInternationalFallback,
  isVerifiedPortalLink,
  parseInternationalPlan,
  recommendInternationalPortal,
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
    expect(INTERNATIONAL_MARKETS).toHaveLength(20);
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
      'RU',
      'SE',
      'NO',
      'SA',
      'QA',
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
    expect(
      INTERNATIONAL_MARKETS.every((market) =>
        market.portals.every(
          (portal) =>
            isVerifiedPortalLink(portal, portal.publishUrl) &&
            isVerifiedPortalLink(portal, portal.pricingUrl)
        )
      )
    ).toBe(true);
  });

  it('fails closed for a URL outside the portal official host allowlist', () => {
    const portal = INTERNATIONAL_MARKETS[0].portals[0];
    expect(isVerifiedPortalLink(portal, 'https://malicious.example/publish')).toBe(
      false
    );
    expect(isVerifiedPortalLink(portal, 'javascript:alert(1)')).toBe(false);
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

  it('builds and parses only the portal selected by the user', () => {
    const germany = INTERNATIONAL_MARKETS[0];
    const portal = germany.portals.find(
      (candidate) => candidate.id === 'immobilienscout24-de',
    );
    expect(portal).toBeDefined();

    const fallback = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
      portal,
    });
    const parsed = parseInternationalPlan(
      JSON.stringify({
        portalCopies: [
          {
            portalId: portal?.id,
            title: 'Wohnung mit Meerblick in Alanya',
            body: 'Verifizierte Objektdaten. Preis: 8.500.000 TRY.',
            steps: ['Anmelden', 'Daten prüfen'],
          },
          {
            portalId: 'kleinanzeigen',
            title: 'Bu portal seçilmedi',
            body: 'Kullanılmamalı',
          },
        ],
      }),
      fallback,
      germany,
      portal,
    );

    expect(parsed.portalCopies).toHaveLength(1);
    expect(parsed.portalCopies[0]?.portalId).toBe('immobilienscout24-de');
    expect(parsed.portalCopies[0]?.body).toContain('TRY');
  });

  it('ships a complete, dated country and portal playbook', () => {
    expect(
      INTERNATIONAL_MARKETS.every(
        (market) =>
          Boolean(market.currency) &&
          Boolean(market.timezone) &&
          Boolean(market.measurementSystem) &&
          Boolean(market.buyerFocus) &&
          Boolean(market.socialChannels?.length)
      )
    ).toBe(true);
    expect(
      INTERNATIONAL_MARKETS.every((market) =>
        market.portals.every(
          (portal) =>
            Boolean(portal.requiredFields?.length) &&
            Boolean(portal.imageGuidance) &&
            (!portal.officialSourceUrl || portal.lastVerifiedAt === '2026-08-13')
        )
      )
    ).toBe(true);

    const germany = INTERNATIONAL_MARKETS[0];
    const plan = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
    });
    expect(plan.portalCopies.every((copy) => Boolean(copy.titleTr))).toBe(true);
    expect(plan.portalCopies.every((copy) => Boolean(copy.bodyTr))).toBe(true);
    expect(plan.socialPlan?.channels.length).toBeGreaterThan(0);
    expect(plan.socialPlan?.complianceNotes.length).toBeGreaterThan(0);
  });

  it('keeps only market-approved social channels from generated output', () => {
    const germany = INTERNATIONAL_MARKETS[0];
    const fallback = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
    });
    const parsed = parseInternationalPlan(
      JSON.stringify({
        countryCode: 'DE',
        socialPlan: {
          channels: [
            {
              channel: 'Instagram',
              objective: 'Nitelikli talep',
              format: '4:5 gönderi',
              contentAngle: 'Konum ve doğrulanmış özellikler',
              localCta: 'Details anfragen',
              publishingWindow: '18:00-20:00 Europe/Berlin',
            },
            {
              channel: 'Bilinmeyen Ağ',
              objective: 'Kullanılmamalı',
              format: 'Bilinmiyor',
              contentAngle: 'Bilinmiyor',
              localCta: 'Bilinmiyor',
              publishingWindow: 'Bilinmiyor',
            },
          ],
          complianceNotes: ['Doğrulanmamış vaat kullanmayın.'],
        },
      }),
      fallback,
      germany
    );

    expect(parsed.socialPlan?.channels).toHaveLength(
      germany.socialChannels?.length ?? 0,
    );
    expect(
      parsed.socialPlan?.channels.find(
        (channel) => channel.channel === 'Instagram',
      )?.localCta,
    ).toBe('Details anfragen');
    expect(
      parsed.socialPlan?.channels.some(
        (channel) => channel.channel === 'Bilinmeyen Ağ',
      ),
    ).toBe(false);
    expect(parsed.socialPlan?.complianceNotes).toEqual(
      expect.arrayContaining([
        ...((fallback.socialPlan?.complianceNotes || [])),
        'Doğrulanmamış vaat kullanmayın.',
      ]),
    );
  });

  it('recommends a proven overseas route instead of the first catalog item', () => {
    const germany = INTERNATIONAL_MARKETS.find((market) => market.code === 'DE');
    const unitedStates = INTERNATIONAL_MARKETS.find(
      (market) => market.code === 'US',
    );
    expect(germany && recommendInternationalPortal(germany)?.id).toBe(
      'immobilienscout24-de',
    );
    expect(unitedStates && recommendInternationalPortal(unitedStates)?.id).toBe(
      'realtor-com',
    );
  });

  it('rejects foreign and invented prices in every generated user-facing area', () => {
    const germany = INTERNATIONAL_MARKETS.find((market) => market.code === 'DE')!;
    const portal = germany.portals.find(
      (candidate) => candidate.id === 'immobilienscout24-de',
    )!;
    const fallback = buildInternationalFallback({
      companyName: 'Jasmine Group',
      property,
      market: germany,
      portal,
    });
    const parsed = parseInternationalPlan(
      JSON.stringify({
        strategy: 'Preis: 6.150.000 Euro',
        warnings: [],
        portalCopies: [
          {
            portalId: portal.id,
            title: 'Wohnung 6.150.000 €',
            body: 'Preis: 7.000.000 TRY',
            titleTr: 'Daire 6.150.000 CHF',
            bodyTr: 'Fiyat 6.150.000 $',
            steps: ['6.150.000 GBP yaz ve yayınla'],
          },
        ],
        socialPlan: {
          channels: [
            {
              channel: 'Instagram',
              objective: '6.150.000 USD fiyatını duyur',
              format: '4:5',
              contentAngle: 'Yatırım',
              localCta: 'Kontakt',
              publishingWindow: '18:00',
            },
          ],
          complianceNotes: [],
        },
      }),
      fallback,
      germany,
      portal,
      property.price,
    );

    expect(parsed.strategy).toBe(fallback.strategy);
    expect(parsed.portalCopies[0]).toEqual(fallback.portalCopies[0]);
    expect(parsed.warnings).toEqual(expect.arrayContaining(fallback.warnings));
    expect(parsed.socialPlan?.complianceNotes).toEqual(
      expect.arrayContaining(fallback.socialPlan?.complianceNotes || []),
    );
    expect(parsed.socialPlan?.channels[0]?.objective).toBe(
      fallback.socialPlan?.channels[0]?.objective,
    );
  });
});
