import { describe, expect, it, vi } from 'vitest';
import {
  buildSourceSessionId,
  buildStickySessionPoolOptions,
  createSourceRequestStartGate,
  prepareSourceNetworkPolicy,
} from './source-network-policy';

describe('Avcı kaynak ağ politikası', () => {
  it('robots.txt dosyasını doğrudan değil aynı proxy oturumundan yükler', async () => {
    let currentTime = 10_000;
    const newUrl = vi
      .fn()
      .mockResolvedValue('http://user:secret@tr-proxy.example:8000');
    const robotsFile = { isAllowed: vi.fn().mockReturnValue(true) };
    const loadRobots = vi.fn().mockResolvedValue(robotsFile);
    const wait = vi.fn(async (milliseconds: number) => {
      currentTime += milliseconds;
    });

    const result = await prepareSourceNetworkPolicy(
      {
        jobId: 'job-123',
        sourceUrl: 'https://www.sahibinden.com/satilik-daire',
        delaySeconds: 13,
        proxyConfiguration: { newUrl },
      },
      { now: () => currentTime, wait, loadRobots }
    );

    expect(result).toMatchObject({
      sourceSessionId: 'hunt_job_123',
      robotsFile,
    });
    expect(result.requestStartGate).toBeDefined();

    expect(newUrl).toHaveBeenCalledWith('hunt_job_123');
    expect(loadRobots).toHaveBeenCalledWith(
      'https://www.sahibinden.com/satilik-daire',
      'http://user:secret@tr-proxy.example:8000'
    );
    await expect(result.requestStartGate.waitForTurn()).resolves.toBe(23_000);
    expect(wait).toHaveBeenCalledWith(13_000);
  });

  it('proxy üretilemezse doğrudan kaynağa bağlanmaz', async () => {
    const loadRobots = vi.fn();

    await expect(
      prepareSourceNetworkPolicy(
        {
          jobId: 'job-123',
          sourceUrl: 'https://www.sahibinden.com/satilik-daire',
          delaySeconds: 13,
          proxyConfiguration: {
            newUrl: vi.fn().mockResolvedValue(undefined),
          },
        },
        { loadRobots }
      )
    ).rejects.toThrow('Türkiye proxy oturumu oluşturulamadı');
    expect(loadRobots).not.toHaveBeenCalled();
  });

  it('robots, LIST ve DETAIL başlangıçlarını job içinde en az 13 saniye ayırır', async () => {
    let currentTime = 10_000;
    const wait = vi.fn(async (milliseconds: number) => {
      currentTime += milliseconds;
    });
    const gate = createSourceRequestStartGate(1, {
      now: () => currentTime,
      wait,
    });

    const robotsStartedAt = await gate.waitForTurn();
    currentTime += 2_000;
    const listStartedAt = await gate.waitForTurn();
    currentTime += 4_000;
    const detailStartedAt = await gate.waitForTurn();

    expect([robotsStartedAt, listStartedAt, detailStartedAt]).toEqual([
      10_000, 23_000, 36_000,
    ]);
    expect(listStartedAt - robotsStartedAt).toBeGreaterThanOrEqual(13_000);
    expect(detailStartedAt - listStartedAt).toBeGreaterThanOrEqual(13_000);
    expect(wait).toHaveBeenNthCalledWith(1, 11_000);
    expect(wait).toHaveBeenNthCalledWith(2, 9_000);
  });

  it('aynı anda istenen turnleri de seri hale getirir', async () => {
    let currentTime = 0;
    const gate = createSourceRequestStartGate(13, {
      now: () => currentTime,
      wait: async (milliseconds) => {
        currentTime += milliseconds;
      },
    });

    await expect(
      Promise.all([
        gate.waitForTurn(),
        gate.waitForTurn(),
        gate.waitForTurn(),
      ])
    ).resolves.toEqual([0, 13_000, 26_000]);
  });

  it('tek job boyunca kullanılacak sabit ve geçerli oturumu sınırlar', () => {
    const sessionId = buildSourceSessionId('iş/123!?');
    expect(sessionId).toBe('hunt_i__123__');
    expect(sessionId.length).toBeLessThanOrEqual(50);
    expect(buildStickySessionPoolOptions(sessionId)).toEqual({
      maxPoolSize: 1,
      sessionOptions: {
        id: sessionId,
        maxUsageCount: 100,
        maxAgeSecs: 1200,
        maxErrorScore: 1,
      },
    });
  });
});
