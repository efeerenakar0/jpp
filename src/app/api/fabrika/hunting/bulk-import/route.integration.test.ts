import AdmZip from 'adm-zip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  enforceRateLimit: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  huntingApiError: vi.fn((error: unknown) =>
    Response.json(
      {
        error:
          error instanceof Error ? error.message : 'İçe aktarma başarısız.',
      },
      { status: 400 }
    )
  ),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/hunting-v2/rate-limit', () => ({
  enforceHuntingRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  huntingApiError: mocks.huntingApiError,
  principalActor: vi.fn(() => ({ key: 'OWNER:company-a' })),
}));

vi.mock('@/lib/hunting-v2/import-package', async () =>
  import('../../../../../lib/hunting-v2/import-package')
);

vi.mock('@/lib/prisma', () => ({
  default: {
    huntedListing: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
  },
}));

import { POST } from './route';

const listing = {
  listingId: '1297022611',
  title: 'Oba mahallesinde satılık 2+1 daire',
  sourceUrl:
    'https://www.sahibinden.com/ilan/emlak-konut-satilik-ornek-1297022611/detay',
  price: '5.850.000 TL',
  location: 'Antalya / Alanya / Oba Mh.',
};

describe('POST /api/fabrika/hunting/bulk-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: 'listing-a' });
  });

  it('ZIP dosyasındaki ilanları oturum tenantına aktarır', async () => {
    const zip = new AdmZip();
    zip.addFile(
      'jasmine_ilanlar.json',
      Buffer.from(JSON.stringify([listing]), 'utf8')
    );
    const formData = new FormData();
    formData.set(
      'file',
      new File([zip.toBuffer()], 'jasmine_portfoy_paketi.zip', {
        type: 'application/zip',
      })
    );

    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/bulk-import', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        sourceListingId: '1297022611',
        ownerPhone: null,
        ownerPhoneNormalized: null,
      }),
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      added: 1,
      skipped: 0,
      ignoredSensitiveFieldCount: 0,
    });
  });

  it('JSON API uyumluluğunu korur', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/bulk-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([listing]),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
