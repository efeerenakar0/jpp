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
      createdAt: new Date('2026-08-03T12:00:00.000Z'),
      completedAt: new Date('2026-08-03T12:05:00.000Z'),
      listings: [
        {
          sourceListingId: '123',
          sourceUrl: 'https://www.sahibinden.com/ilan/123/detay',
          title: 'Deniz manzaralı daire',
          descriptionText: 'Tam açıklama',
          attributesJson: { 'Oda Sayısı': '3+1' },
          images: [{ order: 1, sourceUrl: 'https://image.test/1.jpg' }],
          contacts: [{ maskedPhone: '+90******1234' }],
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
      'business-ai-portfoy-bulucu-job-1.json'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      product: 'Business AI Portföy Bulucu',
      job: { id: 'job-1' },
      listings: [
        {
          sourceListingId: '123',
          attributesJson: { 'Oda Sayısı': '3+1' },
        },
      ],
    });
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
