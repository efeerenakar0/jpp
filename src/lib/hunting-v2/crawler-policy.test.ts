import { describe, expect, it } from 'vitest';
import {
  BUSINESS_AI_CRAWLER_USER_AGENT,
  buildApifyProxyPolicy,
  buildCrawlerPolicy,
  buildSourceRequest,
  failedRequestDelta,
  getCrawlerListingLimit,
  initialSahibindenRequestKind,
  isSourceChallengeStatus,
  selectUniqueListingsWithinLimit,
} from './crawler-policy';

describe('Business AI Portföy Uzmanı tarama politikası', () => {
  it('ilanları tek tek ve kullanıcıdan hız ayarı istemeden işler', () => {
    const policy = buildCrawlerPolicy({});

    expect(policy).toMatchObject({
      minConcurrency: 1,
      maxConcurrency: 1,
      sameDomainDelaySecs: 13,
      maxRequestsPerMinute: 5,
      maxRequestRetries: 0,
      maxSessionRotations: 0,
      retryOnBlocked: false,
      respectRobotsTxtFile: {
        userAgent: BUSINESS_AI_CRAWLER_USER_AGENT,
      },
      useSessionPool: true,
      sessionPoolOptions: { maxPoolSize: 1 },
    });
    expect(policy).not.toHaveProperty('maxRequestsPerCrawl');
  });

  it('sunucu ayarlarını güvenli aralıkta tutar', () => {
    expect(
      buildCrawlerPolicy({
        AVCI_CRAWLER_DELAY_SECS: '1',
        AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE: '500',
      })
    ).toMatchObject({
      sameDomainDelaySecs: 13,
      maxRequestsPerMinute: 5,
    });

    expect(
      buildCrawlerPolicy({
        AVCI_CRAWLER_DELAY_SECS: 'bozuk',
        AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE: 'bozuk',
      })
    ).toMatchObject({
      sameDomainDelaySecs: 13,
      maxRequestsPerMinute: 5,
    });

    expect(getCrawlerListingLimit({})).toBe(11);
    expect(
      getCrawlerListingLimit({ AVCI_CRAWLER_MAX_LISTINGS_PER_JOB: '500' })
    ).toBe(11);
    expect(
      getCrawlerListingLimit({ AVCI_CRAWLER_MAX_LISTINGS_PER_JOB: '0' })
    ).toBe(1);
  });

  it('Apify worker için Türkiye residential proxy politikasını fail-closed kurar', () => {
    expect(
      buildApifyProxyPolicy({
        AVCI_APIFY_PROXY_ENABLED: 'true',
        AVCI_APIFY_PROXY_REQUIRED: 'true',
      })
    ).toEqual({
      enabled: true,
      required: true,
      groups: ['RESIDENTIAL'],
      countryCode: 'TR',
    });

    expect(
      buildApifyProxyPolicy({
        AVCI_APIFY_PROXY_ENABLED: 'true',
        AVCI_APIFY_PROXY_GROUPS: 'residential',
        AVCI_APIFY_PROXY_COUNTRY_CODE: 'tr',
      }).groups
    ).toEqual(['RESIDENTIAL']);

    expect(() =>
      buildApifyProxyPolicy({
        AVCI_APIFY_PROXY_ENABLED: 'true',
        AVCI_APIFY_PROXY_COUNTRY_CODE: 'US',
      })
    ).toThrow('yalnızca Türkiye çıkışlı proxy');

    expect(() =>
      buildApifyProxyPolicy({
        AVCI_APIFY_PROXY_ENABLED: 'true',
        AVCI_APIFY_PROXY_GROUPS: 'DATACENTER',
      })
    ).toThrow('yalnızca RESIDENTIAL proxy');

    expect(buildApifyProxyPolicy({}).required).toBe(true);
  });

  it('robots.txt kontrolünde ürün adını açıkça bildirir, tarayıcı kimliğini bozmaz', () => {
    expect(BUSINESS_AI_CRAWLER_USER_AGENT).toBe(
      'Business-AI-Portfoy-Uzmani/2.0'
    );
    const request = buildSourceRequest({
      kind: 'DETAIL',
      sourceListingId: '123456',
      url: 'https://www.sahibinden.com/ilan/123456/detay',
    });

    expect(request).not.toHaveProperty('headers');
    expect(request.uniqueKey).toBe('DETAIL:123456');
  });

  it('başarısız detay isteğini kısmi, liste isteğini hatalı sayar', () => {
    expect(failedRequestDelta('DETAIL')).toEqual({ partial: 1, failed: 0 });
    expect(failedRequestDelta('LIST')).toEqual({ partial: 0, failed: 1 });
  });

  it('kaynak erişim kısıtlamasında yeniden denemek yerine hemen durur', () => {
    expect([401, 403, 429].every(isSourceChallengeStatus)).toBe(true);
    expect([200, 301, 404, 500].some(isSourceChallengeStatus)).toBe(false);
  });

  it('yinelenen ve 12. ilanı job kuyruğuna almaz', () => {
    const listings = [
      { sourceListingId: 'existing' },
      { sourceListingId: '1' },
      { sourceListingId: '1' },
      ...Array.from({ length: 15 }, (_, index) => ({
        sourceListingId: String(index + 2),
      })),
    ];
    const selected = selectUniqueListingsWithinLimit({
      listings,
      discoveredListingIds: new Set(['existing']),
      limit: 11,
    });

    expect(selected).toHaveLength(10);
    expect(new Set(selected.map((item) => item.sourceListingId)).size).toBe(10);
    expect(selected.at(-1)?.sourceListingId).toBe('10');
  });

  it('tek ilan bağlantısını doğrudan detay isteği olarak sınıflandırır', () => {
    expect(
      initialSahibindenRequestKind(
        'https://www.sahibinden.com/ilan/emlak-konut-satilik-ornek-ilan-1234567890/detay'
      )
    ).toBe('DETAIL');
    expect(
      initialSahibindenRequestKind(
        'https://www.sahibinden.com/satilik-daire/istanbul-kadikoy/sahibinden'
      )
    ).toBe('LIST');
    expect(initialSahibindenRequestKind('geçersiz bağlantı')).toBe('LIST');
  });
});
