import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  huntingApiError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 400 }
    ),
}));

import { POST } from './route';

describe('Avcı job resume route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
  });

  it('eski ücretli işi yeniden kuyruğa almayıp yeni kota kontrollü tarama ister', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/jobs/job-a/resume', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ id: 'job-a' }),
      } as Parameters<typeof POST>[1]
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        'ClearPath taraması devam ettirilemez. Aynı filtrelerle yeni ve kota kontrollü bir tarama başlatın.',
    });
  });

  it('çalışan hesabının eski işi yeniden başlatmasına izin vermez', async () => {
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });

    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/jobs/job-b/resume', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ id: 'job-b' }),
      } as Parameters<typeof POST>[1]
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Avcı taramasını yalnız patron yeniden başlatabilir.',
    });
  });
});
