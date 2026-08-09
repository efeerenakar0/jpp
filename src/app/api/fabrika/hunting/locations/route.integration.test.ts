import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  fetchProvinceOptions: vi.fn(),
  fetchDistrictOptions: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/hunting-v2/location-service', () => ({
  fetchProvinceOptions: mocks.fetchProvinceOptions,
  fetchDistrictOptions: mocks.fetchDistrictOptions,
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  huntingApiError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 400 }
    ),
}));

import { GET } from './route';

describe('Portföy Uzmanı konum API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.fetchProvinceOptions.mockResolvedValue([{ id: 34, name: 'İstanbul' }]);
    mocks.fetchDistrictOptions.mockResolvedValue([{ id: 1103, name: 'Kadıköy' }]);
  });

  it('oturum doğrulamasından sonra il listesini döndürür', async () => {
    const response = await GET(
      new Request('https://app.test/api/fabrika/hunting/locations')
    );

    expect(response.status).toBe(200);
    expect(mocks.requireFabrikaPrincipal).toHaveBeenCalledOnce();
    expect(mocks.fetchProvinceOptions).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 34, name: 'İstanbul' }],
    });
  });

  it('geçerli il kimliğiyle yalnız o ilin ilçelerini döndürür', async () => {
    const response = await GET(
      new Request('https://app.test/api/fabrika/hunting/locations?provinceId=34')
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchDistrictOptions).toHaveBeenCalledWith(34);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 1103, name: 'Kadıköy' }],
    });
  });

  it('izinli aralık dışındaki il kimliğini servise göndermez', async () => {
    const response = await GET(
      new Request('https://app.test/api/fabrika/hunting/locations?provinceId=99')
    );

    expect(response.status).toBe(400);
    expect(mocks.fetchDistrictOptions).not.toHaveBeenCalled();
  });
});
