export const BUSINESS_AI_CRAWLER_USER_AGENT = 'Business-AI-Portfoy-Uzmani/2.0';

type CrawlerEnvironment = Readonly<Record<string, string | undefined>>;

export type SourceRequestKind = 'LIST' | 'DETAIL';

export type ApifyProxyPolicy = Readonly<{
  enabled: boolean;
  required: boolean;
  groups: string[];
  countryCode: 'TR';
}>;

export function initialSahibindenRequestKind(
  value: string
): SourceRequestKind {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isSahibinden =
      hostname === 'sahibinden.com' || hostname === 'www.sahibinden.com';
    const isDetailPath =
      /^\/ilan\/(?:[^/]*-)?\d{5,}\/detay\/?$/i.test(url.pathname);
    return isSahibinden && isDetailPath ? 'DETAIL' : 'LIST';
  } catch {
    return 'LIST';
  }
}

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

export function buildApifyProxyPolicy(
  environment: CrawlerEnvironment = process.env
): ApifyProxyPolicy {
  const enabled = environment.AVCI_APIFY_PROXY_ENABLED === 'true';
  const configuredCountryCode = (
    environment.AVCI_APIFY_PROXY_COUNTRY_CODE || 'TR'
  )
    .trim()
    .toUpperCase();

  if (configuredCountryCode !== 'TR') {
    throw new Error(
      'Avcı worker yalnızca Türkiye çıkışlı proxy ile çalışabilir.'
    );
  }

  const configuredGroups = (
    environment.AVCI_APIFY_PROXY_GROUPS || 'RESIDENTIAL'
  )
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (
    configuredGroups.length !== 1 ||
    configuredGroups[0] !== 'RESIDENTIAL'
  ) {
    throw new Error(
      'Avcı worker yalnızca RESIDENTIAL proxy grubuyla çalışabilir.'
    );
  }

  return {
    enabled,
    required: true,
    groups: ['RESIDENTIAL'],
    countryCode: 'TR',
  };
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
      13,
      13,
      300
    ),
    maxRequestsPerMinute: boundedInteger(
      environment.AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE,
      5,
      1,
      5
    ),
    requestHandlerTimeoutSecs: 45,
    maxRequestRetries: 0,
    maxSessionRotations: 0,
    retryOnBlocked: false,
    respectRobotsTxtFile: { userAgent: BUSINESS_AI_CRAWLER_USER_AGENT },
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 1 },
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
    userData: { kind: input.kind },
  } as const;
}

export function getCrawlerListingLimit(
  environment: CrawlerEnvironment = process.env
) {
  return boundedInteger(
    environment.AVCI_CRAWLER_MAX_LISTINGS_PER_JOB,
    11,
    1,
    11
  );
}

export function selectUniqueListingsWithinLimit<
  T extends { sourceListingId: string },
>(input: {
  listings: readonly T[];
  discoveredListingIds: ReadonlySet<string>;
  limit: number;
}) {
  const selected: T[] = [];
  const seen = new Set(input.discoveredListingIds);

  for (const listing of input.listings) {
    if (seen.has(listing.sourceListingId)) continue;
    if (seen.size >= input.limit) break;
    seen.add(listing.sourceListingId);
    selected.push(listing);
  }

  return selected;
}

export function failedRequestDelta(kind: unknown) {
  return kind === 'DETAIL'
    ? { partial: 1, failed: 0 }
    : { partial: 0, failed: 1 };
}

export function isSourceChallengeStatus(statusCode: number) {
  return statusCode === 401 || statusCode === 403 || statusCode === 429;
}
