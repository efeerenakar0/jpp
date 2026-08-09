import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { runHuntWorker, shouldRunHuntWorkerOnce } from './worker-runtime';

describe('Avcı worker çalışma döngüsü', () => {
  it('Apify Actor çalışma kimliğini otomatik tek-sefer modu sayar', () => {
    expect(shouldRunHuntWorkerOnce({ ACTOR_RUN_ID: 'run-123' })).toBe(true);
    expect(shouldRunHuntWorkerOnce({ AVCI_RUN_ONCE: 'true' })).toBe(true);
    expect(shouldRunHuntWorkerOnce({ AVCI_RUN_ONCE: 'false' })).toBe(false);
  });

  it('tek-sefer modunda kuyruğu yalnız bir kez kontrol edip çıkar', async () => {
    const runNext = vi.fn().mockResolvedValue(null);
    const wait = vi.fn();

    await runHuntWorker({
      runNext,
      wait,
      pollMs: 5_000,
      runOnce: true,
      shouldStop: () => false,
      reportError: vi.fn(),
    });

    expect(runNext).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('tek-sefer modundaki hatayı Apify çalışmasının başarısız sayılması için yükseltir', async () => {
    const error = new Error('veritabanı bağlantısı kurulamadı');
    const reportError = vi.fn();

    await expect(
      runHuntWorker({
        runNext: vi.fn().mockRejectedValue(error),
        wait: vi.fn(),
        pollMs: 5_000,
        runOnce: true,
        shouldStop: () => false,
        reportError,
      })
    ).rejects.toBe(error);
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('sürekli modda boş kuyruktan sonra bekler ve kapanma isteğine uyar', async () => {
    let stopped = false;
    const wait = vi.fn().mockImplementation(async () => {
      stopped = true;
    });
    const runNext = vi.fn().mockResolvedValue(null);

    await runHuntWorker({
      runNext,
      wait,
      pollMs: 5_000,
      runOnce: false,
      shouldStop: () => stopped,
      reportError: vi.fn(),
    });

    expect(runNext).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(5_000);
  });

  it('sürekli modda geçici hatayı raporlar, bekler ve sonraki tura izin verir', async () => {
    let stopped = false;
    const error = new Error('geçici hata');
    const wait = vi.fn().mockImplementation(async () => {
      stopped = true;
    });
    const reportError = vi.fn();

    await runHuntWorker({
      runNext: vi.fn().mockRejectedValue(error),
      wait,
      pollMs: 3_000,
      runOnce: false,
      shouldStop: () => stopped,
      reportError,
    });

    expect(reportError).toHaveBeenCalledWith(error);
    expect(wait).toHaveBeenCalledWith(3_000);
  });

  it('iş işlendiğinde ve hata sırasında kapanma istendiğinde gereksiz bekleme yapmaz', async () => {
    let stoppedAfterJob = false;
    const jobWait = vi.fn();

    await runHuntWorker({
      runNext: vi.fn().mockImplementation(async () => {
        stoppedAfterJob = true;
        return { id: 'job-1' };
      }),
      wait: jobWait,
      pollMs: 5_000,
      runOnce: false,
      shouldStop: () => stoppedAfterJob,
      reportError: vi.fn(),
    });
    expect(jobWait).not.toHaveBeenCalled();

    let stoppedAfterError = false;
    const errorWait = vi.fn();
    await runHuntWorker({
      runNext: vi.fn().mockRejectedValue(new Error('kapanırken hata')),
      wait: errorWait,
      pollMs: 5_000,
      runOnce: false,
      shouldStop: () => stoppedAfterError,
      reportError: () => {
        stoppedAfterError = true;
      },
    });
    expect(errorWait).not.toHaveBeenCalled();
  });
});
