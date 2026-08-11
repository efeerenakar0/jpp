import { describe, expect, it, vi } from 'vitest';
import {
  buildSourceSessionId,
  buildStickySessionPoolOptions,
  prepareSourceNetworkPolicy,
} from './source-network-policy';

describe('Avcı kaynak ağ politikası', () => {
  it('robots.txt dosyasını doğrudan değil aynı proxy oturumundan yükler', async () => {
    const newUrl = vi
      .fn()
      .mockResolvedValue('http://user:secret@tr-proxy.example:8000');
    const robotsFile = { isAllowed: vi.fn().mockReturnValue(true) };
    const loadRobots = vi.fn().mockResolvedValue(robotsFile);

    await expect(
      prepareSourceNetworkPolicy(
        {
          jobId: 'job-123',
          sourceUrl: 'https://www.sahibinden.com/satilik-daire',
          delaySeconds: 13,
          proxyConfiguration: { newUrl },
        },
        { now: () => 10_000, loadRobots }
      )
    ).resolves.toEqual({
      sourceSessionId: 'hunt_job_123',
      robotsFile,
      firstNavigationAt: 23_000,
    });

    expect(newUrl).toHaveBeenCalledWith('hunt_job_123');
    expect(loadRobots).toHaveBeenCalledWith(
      'https://www.sahibinden.com/satilik-daire',
      'http://user:secret@tr-proxy.example:8000'
    );
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
