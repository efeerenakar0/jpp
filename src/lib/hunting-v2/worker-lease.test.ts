import { describe, expect, it } from 'vitest';
import { buildWorkerLease } from './worker-lease';

describe('Portföy Uzmanı worker kira süresi', () => {
  it('kuyruktaki ve kalp atışı kesilmiş işleri aday yapar', () => {
    const lease = buildWorkerLease(
      new Date('2026-08-09T12:10:00.000Z'),
      { AVCI_WORKER_STALE_MS: '300000' }
    );

    expect(lease.staleBefore.toISOString()).toBe('2026-08-09T12:05:00.000Z');
    expect(lease.candidateWhere).toEqual({
      OR: [
        { status: 'QUEUED' },
        {
          status: 'RUNNING',
          lastHeartbeatAt: { lt: lease.staleBefore },
        },
      ],
    });
  });

  it('yanlış ortam değerini güvenli varsayılana döndürür', () => {
    const now = new Date('2026-08-09T12:10:00.000Z');
    expect(
      buildWorkerLease(now, { AVCI_WORKER_STALE_MS: 'bozuk' }).staleBefore
    ).toEqual(new Date('2026-08-09T12:05:00.000Z'));
    expect(
      buildWorkerLease(now, { AVCI_WORKER_STALE_MS: '1000' }).staleBefore
    ).toEqual(new Date('2026-08-09T12:09:00.000Z'));
  });
});
