import 'server-only';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export class HuntingRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.');
    this.name = 'HuntingRateLimitError';
  }
}

export function enforceHuntingRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now()
) {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  if (existing.count >= options.limit) {
    throw new HuntingRateLimitError(
      Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    );
  }
  existing.count += 1;
}

export function resetHuntingRateLimitsForTests() {
  buckets.clear();
}
