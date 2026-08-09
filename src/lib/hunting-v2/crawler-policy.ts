export const BUSINESS_AI_CRAWLER_USER_AGENT = 'Business-AI-Portfoy-Uzmani/2.0';

type CrawlerEnvironment = Readonly<Record<string, string | undefined>>;

export type SourceRequestKind = 'LIST' | 'DETAIL';

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

/**
 * Kaynak dostu varsayılanlar yalnızca sunucuda yönetilir. Ürün son kullanıcıya
 * hız, eşzamanlılık veya sayfa limiti ayarı göstermez.
 */
export function buildCrawlerPolicy(
  environment: CrawlerEnvironment = process.env
) {
  return {
    minConcurrency: 1,
    maxConcurrency: 1,
    sameDomainDelaySecs: boundedInteger(
      environment.AVCI_CRAWLER_DELAY_SECS,
      20,
      10,
      300
    ),
    maxRequestsPerMinute: boundedInteger(
      environment.AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE,
      3,
      1,
      6
    ),
    requestHandlerTimeoutSecs: 45,
    maxRequestRetries: 0,
    retryOnBlocked: false,
    respectRobotsTxtFile: true,
    useSessionPool: false,
  } as const;
}

export function buildSourceRequest(input: {
  kind: SourceRequestKind;
  url: string;
  sourceListingId?: string;
}) {
  const identity =
    input.kind === 'DETAIL' && input.sourceListingId
      ? input.sourceListingId
      : input.url;

  return {
    url: input.url,
    uniqueKey: `${input.kind}:${identity}`,
    headers: {
      'user-agent': BUSINESS_AI_CRAWLER_USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'tr-TR,tr;q=0.9',
    },
    userData: { kind: input.kind },
  } as const;
}

export function failedRequestDelta(kind: unknown) {
  return kind === 'DETAIL'
    ? { partial: 1, failed: 0 }
    : { partial: 0, failed: 1 };
}
