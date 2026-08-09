import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  findJob: vi.fn(),
  huntingApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Hata' },
      { status: 400 }
    )
  ),
  decryptContactPhone: vi.fn(() => '905551112233'),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: { huntJob: { findFirst: mocks.findJob } },
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  huntingApiError: mocks.huntingApiError,
}));

vi.mock('@/lib/hunting-v2/contact-crypto', () => ({
  decryptContactPhone: mocks.decryptContactPhone,
}));

import { GET } from './route';

describe('Avcı işi JSON dışa aktarımı', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: { id: 'company-a' },
    });
    mocks.findJob.mockResolvedValue({
      id: 'job-1',
      provider: 'SAHIBINDEN',
      searchUrl: 'https://www.sahibinden.com/satilik',
      status: 'COMPLETED',
      sourceAuthorization: {
        status: 'ACTIVE',
        allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ', 'CONTACT_READ'],
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
      createdAt: new Date('2026-08-03T12:00:00.000Z'),
      completedAt: new Date('2026-08-03T12:05:00.000Z'),
      listings: [
        {
          sourceListingId: '123',
          sourceUrl: 'https://www.sahibinden.com/ilan/123/detay',
          title: 'Deniz manzaralı daire',
          ownerName: 'İlan Sahibi',
          descriptionText: 'Tam açıklama',
          attributesJson: { 'Oda Sayısı': '3+1' },
          images: [{ order: 1, sourceUrl: 'https://image.test/1.jpg' }],
          contacts: [
            {
              maskedPhone: '+90******1234',
              phoneCiphertext: 'encrypted-phone',
              sourceType: 'AUTHORIZED_SOURCE',
            },
          ],
        },
      ],
    });
  });

  it('işi yalnız oturumdaki şirkete göre bulur ve indirilebilir JSON döndürür', async () => {
    const response = await GET(
      new Request('http://localhost/api/fabrika/hunting/jobs/job-1/export'),
      { params: Promise.resolve({ id: 'job-1' }) } as never
    );

    expect(mocks.findJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', companyAccountId: 'company-a' },
      })
    );
    expect(response.headers.get('content-disposition')).toContain(
      'business-ai-portfoy-uzmani-job-1.json'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 2,
      product: 'Business AI Portföy Uzmanı',
      job: { id: 'job-1' },
      listings: [
        {
          sourceListingId: '123',
          sellerName: 'İlan Sahibi',
          attributesJson: { 'Oda Sayısı': '3+1' },
          contacts: [
            expect.objectContaining({
              phone: '+905551112233',
            }),
          ],
        },
      ],
    });
    expect(mocks.decryptContactPhone).toHaveBeenCalledWith('encrypted-phone');
  });

  it('CONTACT_READ yetkisi yoksa ham telefonu dışa aktarmaz', async () => {
    mocks.findJob.mockResolvedValue({
      id: 'job-1',
      provider: 'SAHIBINDEN',
      status: 'COMPLETED',
      sourceAuthorization: {
        status: 'ACTIVE',
        allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'],
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
      },
      listings: [
        {
          sourceListingId: '123',
          ownerName: 'İlan Sahibi',
          contacts: [
            {
              maskedPhone: '+90******1234',
              phoneCiphertext: 'encrypted-phone',
              sourceType: 'AUTHORIZED_SOURCE',
            },
          ],
          images: [],
        },
      ],
    });

    const response = await GET(
      new Request('http://localhost/api/fabrika/hunting/jobs/job-1/export'),
      { params: Promise.resolve({ id: 'job-1' }) } as never
    );
    const payload = await response.json();

    expect(payload.listings[0].contacts[0]).not.toHaveProperty('phone');
    expect(mocks.decryptContactPhone).not.toHaveBeenCalled();
  });

  it('kaynak yetkisiyle başka bir iletişim kanalının şifresini çözmez', async () => {
    const job = await mocks.findJob();
    job.listings[0].contacts = [
      {
        maskedPhone: '+90******9999',
        phoneCiphertext: 'crm-encrypted-phone',
        sourceType: 'EXISTING_CRM',
      },
    ];
    mocks.findJob.mockResolvedValue(job);

    const response = await GET(
      new Request('http://localhost/api/fabrika/hunting/jobs/job-1/export'),
      { params: Promise.resolve({ id: 'job-1' }) } as never
    );
    const payload = await response.json();

    expect(payload.listings[0].contacts[0]).not.toHaveProperty('phone');
    expect(mocks.decryptContactPhone).not.toHaveBeenCalled();
  });

  it('başka şirkete ait veya bulunmayan işi boş dosya olarak döndürmez', async () => {
    mocks.findJob.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/fabrika/hunting/jobs/job-x/export'),
      { params: Promise.resolve({ id: 'job-x' }) } as never
    );

    expect(response.status).toBe(400);
    expect(mocks.huntingApiError).toHaveBeenCalledWith(expect.any(Error));
  });
});
