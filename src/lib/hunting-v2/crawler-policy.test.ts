import { describe, expect, it } from 'vitest';
import {
  BUSINESS_AI_CRAWLER_USER_AGENT,
  buildCrawlerPolicy,
  buildSourceRequest,
  failedRequestDelta,
} from './crawler-policy';

describe('Business AI Portföy Bulucu tarama politikası', () => {
  it('ilanları tek tek ve kullanıcıdan hız ayarı istemeden işler', () => {
    const policy = buildCrawlerPolicy({});

    expect(policy).toMatchObject({
      minConcurrency: 1,
      maxConcurrency: 1,
      sameDomainDelaySecs: 20,
      maxRequestsPerMinute: 3,
      maxRequestRetries: 0,
      retryOnBlocked: false,
      respectRobotsTxtFile: true,
      useSessionPool: false,
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
      sameDomainDelaySecs: 10,
      maxRequestsPerMinute: 6,
    });

    expect(
      buildCrawlerPolicy({
        AVCI_CRAWLER_DELAY_SECS: 'bozuk',
        AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE: 'bozuk',
      })
    ).toMatchObject({
      sameDomainDelaySecs: 20,
      maxRequestsPerMinute: 3,
    });
  });

  it('her istekte ürün adını açıkça bildirir', () => {
    const request = buildSourceRequest({
      kind: 'DETAIL',
      sourceListingId: '123456',
      url: 'https://www.sahibinden.com/ilan/123456/detay',
    });

    expect(request.headers).toMatchObject({
      'user-agent': BUSINESS_AI_CRAWLER_USER_AGENT,
      'accept-language': 'tr-TR,tr;q=0.9',
    });
    expect(request.uniqueKey).toBe('DETAIL:123456');
  });

  it('başarısız detay isteğini kısmi, liste isteğini hatalı sayar', () => {
    expect(failedRequestDelta('DETAIL')).toEqual({ partial: 1, failed: 0 });
    expect(failedRequestDelta('LIST')).toEqual({ partial: 0, failed: 1 });
  });
});
