import { describe, expect, it } from 'vitest';

import {
  assertCampaignReadyForPublication,
  assertAdPublicationTransition,
  buildAdExportPackage,
  canClaimManualPublication,
} from './ad-publication';

describe('manual advertising publication', () => {
  it('never claims publication without external evidence', () => {
    expect(canClaimManualPublication({ externalUrl: null, proofUrl: null })).toBe(
      false
    );
    expect(
      canClaimManualPublication({
        externalUrl: 'https://ads.example/campaign/42',
        proofUrl: null,
      })
    ).toBe(true);
    expect(
      canClaimManualPublication({
        externalUrl: 'javascript:alert(1)',
        proofUrl: null,
      })
    ).toBe(false);
  });

  it('supports only truthful export/manual-confirm transitions', () => {
    expect(() =>
      assertAdPublicationTransition('DRAFT', 'READY_TO_PUBLISH')
    ).not.toThrow();
    expect(() =>
      assertAdPublicationTransition('EXPORTED', 'MANUALLY_CONFIRMED', {
        externalUrl: null,
        proofUrl: null,
      })
    ).toThrow(/kanıt/iu);
    expect(() =>
      assertAdPublicationTransition('EXPORTED', 'MANUALLY_CONFIRMED', {
        externalUrl: 'https://ads.example/campaign/42',
        proofUrl: null,
      })
    ).not.toThrow();
  });

  it('requires at least one approved channel and a poster before export', () => {
    expect(() =>
      assertCampaignReadyForPublication({
        posterHeadline: null,
        adCopies: [],
      })
    ).toThrow(/poster/iu);

    expect(() =>
      assertCampaignReadyForPublication({
        posterHeadline: 'Yeni yaşam',
        adCopies: [
          {
            approved: false,
            platform: 'INSTAGRAM',
            headline: 'Başlık',
            body: 'Metin',
            callToAction: null,
            targetUrl: null,
          },
        ],
      })
    ).toThrow(/onay/iu);

    expect(() =>
      assertCampaignReadyForPublication({
        posterHeadline: 'Yeni yaşam',
        adCopies: [
          {
            approved: true,
            platform: 'INSTAGRAM',
            headline: 'Başlık',
            body: 'Metin',
            callToAction: null,
            targetUrl: null,
          },
        ],
      })
    ).not.toThrow();
  });

  it('builds a deterministic, downloadable package without claiming publication', () => {
    const result = buildAdExportPackage(
      {
        id: 'campaign-1',
        name: 'Oba 2+1 kampanyası',
        description: 'Doğrulanmış portföy kampanyası',
        objective: 'Nitelikli talep',
        audience: 'Aileler',
        posterHeadline: 'Oba’da yeni yaşam',
        posterSubline: '2+1 · 105 m²',
        posterCta: 'Detayları inceleyin',
        property: {
          id: 'property-1',
          title: 'Oba 2+1',
          referenceCode: 'P-104',
          location: 'Alanya / Oba',
          price: 5_850_000,
        },
        adCopies: [
          {
            approved: true,
            platform: 'INSTAGRAM',
            headline: 'Oba’da ferah 2+1',
            body: 'Doğrulanmış bilgilerle hazırlanan açıklama.',
            callToAction: 'Bilgi alın',
            targetUrl: 'https://example.com/p-104',
          },
        ],
      },
      new Date('2026-08-04T12:00:00.000Z'),
    );

    expect(result).toMatchObject({
      version: 1,
      generatedAt: '2026-08-04T12:00:00.000Z',
      publicationClaim: 'NOT_PUBLISHED',
      campaign: { id: 'campaign-1', name: 'Oba 2+1 kampanyası' },
      assets: {
        squarePosterUrl:
          '/api/fabrika/marketing/poster/campaign-1?format=square&download=1',
        storyPosterUrl:
          '/api/fabrika/marketing/poster/campaign-1?format=story&download=1',
      },
    });
    expect(result.channels).toHaveLength(1);
    expect(result.utm.campaign).toBe('oba-2-1-kampanyasi');
    expect(result.checklist.join(' ')).toMatch(/manuel/iu);
  });
});
