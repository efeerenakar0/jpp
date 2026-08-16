import { describe, expect, it } from 'vitest';
import {
  allHuntingQuotaPolicies,
  buildPublicClearpathCachePayload,
  buildClearpathActorInput,
  clearpathActorInputSchema,
  clearpathDatasetItemSchema,
  clearpathSearchCacheKey,
  deterministicListingRank,
  evaluateClearpathOwnerOnly,
  huntingQuotaPolicy,
  istanbulMonthWindow,
} from './clearpath-contract';

const ownerItem = clearpathDatasetItemSchema.parse({
  id: '1305023423',
  url: 'https://www.sahibinden.com/ilan/emlak-konut-1305023423/detay',
  title: 'Sahibinden satilik daire',
  sellerType: 'STANDARD',
  attributes: { Kimden: 'Sahibinden' },
  storeId: null,
  storeName: null,
});

describe('ClearPath Avci contract', () => {
  it('konut icin 50/500, diger her kategori icin 5/15 uygular', () => {
    expect(huntingQuotaPolicy('KONUT')).toMatchObject({
      perRunLimit: 50,
      monthlyLimit: 500,
    });
    const policies = allHuntingQuotaPolicies();
    expect(policies).toHaveLength(7);
    for (const policy of policies.filter(({ propertyType }) => propertyType !== 'KONUT')) {
      expect(policy).toMatchObject({ perRunLimit: 5, monthlyLimit: 15 });
    }
  });

  it('actor girdisini yalniz canli schema alanlariyla kurar', () => {
    expect(
      buildClearpathActorInput({
        searchUrl:
          'https://www.sahibinden.com/emlak-konut/antalya-alanya-oba/sahibinden',
        propertyType: 'KONUT',
      })
    ).toEqual({
      startUrls: [
        'https://www.sahibinden.com/emlak-konut/antalya-alanya-oba/sahibinden',
      ],
      enrichment: true,
      maxResults: 50,
    });
    expect(() =>
      clearpathActorInputSchema.parse({
        startUrls: ['https://www.sahibinden.com/emlak-konut'],
        enrichment: true,
        maxResults: 51,
      })
    ).toThrow();
  });

  it('Istanbul ay sinirini UTC olarak dogru hesaplar', () => {
    expect(istanbulMonthWindow(new Date('2026-08-31T20:59:59.999Z'))).toEqual({
      periodStart: new Date('2026-07-31T21:00:00.000Z'),
      periodEnd: new Date('2026-08-31T21:00:00.000Z'),
    });
    expect(istanbulMonthWindow(new Date('2026-08-31T21:00:00.000Z'))).toEqual({
      periodStart: new Date('2026-08-31T21:00:00.000Z'),
      periodEnd: new Date('2026-09-30T21:00:00.000Z'),
    });
  });

  it('owner tab + pozitif sahip kaniti ister ve ofis/store kaydini reddeder', () => {
    const ownerUrl =
      'https://www.sahibinden.com/emlak-konut/antalya-alanya-oba/sahibinden';
    expect(evaluateClearpathOwnerOnly(ownerItem, ownerUrl)).toMatchObject({
      accepted: true,
    });
    expect(
      evaluateClearpathOwnerOnly(
        { ...ownerItem, storeId: '123', storeName: 'Ornek Emlak' },
        ownerUrl
      )
    ).toEqual({ accepted: false, reason: 'STORE_ID_PRESENT' });
    expect(
      evaluateClearpathOwnerOnly(
        {
          ...ownerItem,
          sellerType: 'AGENT',
          attributes: { Kimden: 'Emlak Ofisinden' },
        },
        ownerUrl
      )
    ).toEqual({ accepted: false, reason: 'BUSINESS_SELLER_EVIDENCE' });
    expect(
      evaluateClearpathOwnerOnly(ownerItem, ownerUrl.replace('/sahibinden', ''))
    ).toEqual({ accepted: false, reason: 'OWNER_TAB_NOT_REQUESTED' });
  });

  it('cache ve rotation anahtarlarini deterministik uretir', () => {
    const actorInput = buildClearpathActorInput({
      searchUrl:
        'https://www.sahibinden.com/emlak-konut/antalya-alanya-oba/sahibinden',
      propertyType: 'KONUT',
    });
    const cacheKey = clearpathSearchCacheKey({
      searchUrl: actorInput.startUrls[0],
      propertyType: 'KONUT',
      actorInput,
    });
    expect(cacheKey).toMatch(/^[a-f0-9]{64}$/);
    expect(deterministicListingRank(cacheKey, '123')).toBe(
      deterministicListingRank(cacheKey, '123')
    );
    expect(deterministicListingRank(cacheKey, '123')).not.toBe(
      deterministicListingRank(cacheKey, '456')
    );
  });

  it('ortak cache icine telefon, aciklama veya Actor tarafindan eklenen alanlari koymaz', () => {
    const parsed = clearpathDatasetItemSchema.parse({
      ...ownerItem,
      phoneNumbers: ['+90 555 111 22 33'],
      phoneMobile: '+90 555 444 55 66',
      sellerName: 'Kisisel isim',
      description: 'Ozel aciklama',
      attributes: {
        Kimden: 'Sahibinden',
        contact: { phone: '+90 555 777 88 99' },
      },
      unexpectedContact: { phone: '+90 555 000 11 22' },
    });

    const payload = buildPublicClearpathCachePayload(parsed);
    expect(JSON.stringify(payload)).not.toMatch(/555|phone|Kisisel isim|Ozel aciklama/);
    expect(payload).toMatchObject({
      id: ownerItem.id,
      url: ownerItem.url,
      title: ownerItem.title,
      sellerType: ownerItem.sellerType,
    });
  });
});
