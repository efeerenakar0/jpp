import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createHuntWorkerCapability,
  verifyHuntWorkerCapability,
} from './worker-capability';

const environment = {
  AVCI_WORKER_SIGNING_SECRET:
    'test-only-worker-signing-secret-with-more-than-32-characters',
};
const now = new Date('2026-08-11T10:00:00.000Z');
const leaseId = '550e8400-e29b-41d4-a716-446655440000';

describe('Avci worker capability', () => {
  it('job ve lease bilgisine bagli kisa omurlu yetki uretir', () => {
    const token = createHuntWorkerCapability(
      { jobId: 'job-a', leaseId, now, lifetimeSeconds: 900 },
      environment
    );

    expect(
      verifyHuntWorkerCapability(
        token,
        { expectedJobId: 'job-a', now: new Date(now.getTime() + 60_000) },
        environment
      )
    ).toMatchObject({
      version: 1,
      jobId: 'job-a',
      leaseId,
    });
  });

  it('degistirilmis, baska ise ait veya suresi gecmis yetkiyi reddeder', () => {
    const token = createHuntWorkerCapability(
      { jobId: 'job-a', leaseId, now, lifetimeSeconds: 60 },
      environment
    );

    expect(() =>
      verifyHuntWorkerCapability(
        `${token.slice(0, -1)}x`,
        { expectedJobId: 'job-a', now },
        environment
      )
    ).toThrow('gecersiz');
    expect(() =>
      verifyHuntWorkerCapability(
        token,
        { expectedJobId: 'job-b', now },
        environment
      )
    ).toThrow('gecersiz');
    expect(() =>
      verifyHuntWorkerCapability(
        token,
        { expectedJobId: 'job-a', now: new Date(now.getTime() + 180_000) },
        environment
      )
    ).toThrow('gecersiz');
  });

  it('kisa imzalama anahtariyla fail-closed davranir', () => {
    expect(() =>
      createHuntWorkerCapability(
        { jobId: 'job-a', leaseId, now },
        { AVCI_WORKER_SIGNING_SECRET: 'short' }
      )
    ).toThrow('en az 32');
  });
});
