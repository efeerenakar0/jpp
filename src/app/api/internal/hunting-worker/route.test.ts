import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  claim: vi.fn(),
  control: vi.fn(),
  discover: vi.fn(),
  detail: vi.fn(),
  progress: vi.fn(),
  finish: vi.fn(),
}));

vi.mock('@/lib/hunting-v2/worker-capability', () => ({
  verifyHuntWorkerCapability: mocks.verify,
}));

vi.mock('@/lib/hunting-v2/worker-local-store', () => ({
  createLocalHuntWorkerStore: () => ({
    claim: mocks.claim,
    control: mocks.control,
    discover: mocks.discover,
    detail: mocks.detail,
    progress: mocks.progress,
    finish: mocks.finish,
  }),
}));

import { POST } from './route';

function request(body: unknown, token = 'capability-token') {
  return new Request('https://app.test/api/internal/hunting-worker', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('internal Avci worker API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue({ jobId: 'job-a' });
    mocks.claim.mockResolvedValue({
      id: 'job-a',
      provider: 'SAHIBINDEN',
      searchUrl: 'https://www.sahibinden.com/satilik',
      status: 'RUNNING',
      startedAt: '2026-08-11T10:00:00.000Z',
    });
  });

  it('gecerli job capability ile yalniz imzali isi claim eder', async () => {
    const response = await POST(request({ action: 'claim', jobId: 'job-a' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.verify).toHaveBeenCalledWith('capability-token');
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });

  it('capability ile body job uyusmazsa store mutation yapmaz', async () => {
    const response = await POST(request({ action: 'claim', jobId: 'job-b' }));

    expect(response.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('yetkisiz ve semasi gecersiz istekleri fail-closed reddeder', async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const unauthorized = await POST(
      request({ action: 'claim', jobId: 'job-a' })
    );
    expect(unauthorized.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();

    mocks.verify.mockReturnValue({ jobId: 'job-a' });
    const invalid = await POST(
      request({ action: 'claim', jobId: 'job-a', companyAccountId: 'evil' })
    );
    expect(invalid.status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
