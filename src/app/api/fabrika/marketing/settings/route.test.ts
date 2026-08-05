import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class SessionError extends Error {}
  class ForbiddenError extends Error {}
  return {
    requirePrincipal: vi.fn(),
    SessionError,
    ForbiddenError,
  };
});

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

import { GET, PUT } from './route';

describe('/api/fabrika/marketing/settings', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('her oturum sahibine yalnız platform hazır bilgisini verir', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_platform-secret');
    mocks.requirePrincipal.mockResolvedValue({ account: { id: 'company-a' } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      managedByPlatform: true,
      ready: true,
      service: 'Business CEO AI',
    });
    expect(JSON.stringify(body)).not.toMatch(/key|provider|model|hint/i);
  });

  it('müşterinin sağlayıcı anahtarı yazmasını reddeder', async () => {
    mocks.requirePrincipal.mockResolvedValue({ account: { id: 'company-a' } });
    const response = await PUT(
      new Request('https://example.test/api/fabrika/marketing/settings', {
        method: 'PUT',
        body: JSON.stringify({ apiKey: 'customer-secret', model: 'openrouter/free' }),
      })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(JSON.stringify(await response.json())).not.toContain('customer-secret');
  });

  it('oturumsuz isteği reddeder', async () => {
    mocks.requirePrincipal.mockRejectedValue(new mocks.SessionError('Oturum yok'));
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
