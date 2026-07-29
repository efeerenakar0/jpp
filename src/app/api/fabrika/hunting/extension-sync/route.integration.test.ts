import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: vi.fn(),
}));
vi.mock('@/lib/hunting-v2/job-service', () => ({
  createHuntJob: vi.fn(),
}));
vi.mock('@/lib/hunting-v2/rate-limit', () => ({
  enforceHuntingRateLimit: vi.fn(),
  HuntingRateLimitError: class HuntingRateLimitError extends Error {},
}));
vi.mock('@/lib/hunting-v2/security', () => ({
  assertAllowedSourceUrl: vi.fn(),
}));
vi.mock('@/lib/hunting-v2/api', () => ({
  principalActor: vi.fn(),
  huntingApiError: (error: unknown) =>
    new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'İşlem başarısız.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    ),
}));

import { OPTIONS } from './route';

describe('Avcı eklentisi CORS sınırı', () => {
  beforeEach(() => {
    process.env.HUNTING_EXTENSION_ALLOWED_ORIGINS =
      'chrome-extension://allowed-extension';
  });

  it('yalnız yapılandırılmış origin için credential CORS başlıklarını döndürür', async () => {
    const response = await OPTIONS(
      new Request('https://app.example/api/fabrika/hunting/extension-sync', {
        method: 'OPTIONS',
        headers: { Origin: 'chrome-extension://allowed-extension' },
      })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'chrome-extension://allowed-extension'
    );
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
      'true'
    );
  });

  it('izinli olmayan origin için wildcard dönmez', async () => {
    const response = await OPTIONS(
      new Request('https://app.example/api/fabrika/hunting/extension-sync', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
