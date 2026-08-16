import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  synchronize: vi.fn(),
  recoverDispatches: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { huntJob: { findMany: mocks.findMany } },
}));

vi.mock('@/lib/hunting-v2/clearpath-ingest', () => ({
  synchronizeClearpathJob: mocks.synchronize,
}));

vi.mock('@/lib/hunting-v2/job-service', () => ({
  recoverQueuedClearpathDispatches: mocks.recoverDispatches,
}));

import { GET } from './route';

function request(secret = 'cron-secret') {
  return new Request('https://example.test/api/cron/hunting-sync', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('Avcı Apify sonuç eşitleme cron işi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    mocks.findMany.mockResolvedValue([{ id: 'job-a' }, { id: 'job-b' }]);
    mocks.recoverDispatches.mockResolvedValue({ checked: 0, recovered: 0, failed: 0 });
  });

  it('gizli anahtar olmadan veritabanına dokunmaz', async () => {
    const response = await GET(request('yanlis'));
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.recoverDispatches).not.toHaveBeenCalled();
  });

  it('sekme kapalı olsa bile aktif işleri sonuçlandırır', async () => {
    mocks.synchronize
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'pending' });

    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: 2,
      completed: 1,
      pending: 1,
    });
    expect(mocks.synchronize).toHaveBeenCalledTimes(2);
    expect(mocks.recoverDispatches).toHaveBeenCalledTimes(1);
  });

  it('bir iş hata verirse diğer ofislerin işlerini durdurmaz', async () => {
    mocks.synchronize
      .mockRejectedValueOnce(new Error('geçici ağ hatası'))
      .mockResolvedValueOnce({ status: 'completed' });

    const response = await GET(request());
    await expect(response.json()).resolves.toMatchObject({
      checked: 2,
      completed: 1,
      pending: 1,
    });
    expect(mocks.synchronize).toHaveBeenCalledTimes(2);
  });
});
