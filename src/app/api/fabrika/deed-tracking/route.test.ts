import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  listCases: vi.fn(),
  createCase: vi.fn(),
  updateCase: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fabrika-session')>()),
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock('@/lib/deed-tracking-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/deed-tracking-service')>()),
  listDeedTrackingCases: mocks.listCases,
  createDeedTrackingCase: mocks.createCase,
  updateDeedTrackingCase: mocks.updateCase,
}));

import { GET, PATCH, POST } from './route';
import { EMPTY_DEED_WORKFLOW } from '@/lib/deed-workflow';

describe('/api/fabrika/deed-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.listCases.mockResolvedValue([]);
    mocks.createCase.mockResolvedValue({ id: 'deed-a' });
    mocks.updateCase.mockResolvedValue({ id: 'deed-a', version: 2 });
  });

  it('lists only the authenticated company cases', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.listCases).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      assignedMemberId: undefined,
    });
  });

  it('scopes employee reads and creates to that employee', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    await GET();
    expect(mocks.listCases).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      assignedMemberId: 'member-a',
    });

    const response = await POST(
      new Request('https://app.test/api/fabrika/deed-tracking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'P-104 satış tapu takibi',
          type: 'SALE',
          guideId: 'standard-sale',
          assignedMemberId: 'member-other-company',
        }),
      })
    );
    expect(response.status).toBe(201);
    expect(mocks.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        data: expect.objectContaining({
          assignedMemberId: 'member-a',
          guideId: 'standard-sale',
        }),
      })
    );
  });

  it('rejects an employee trying to reassign a case', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/deed-tracking', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'deed-a',
          version: 1,
          assignedMemberId: 'member-b',
        }),
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.updateCase).not.toHaveBeenCalled();
  });

  it('accepts the complete operational workflow contract', async () => {
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/deed-tracking', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'deed-a',
          version: 1,
          workflow: {
            ...EMPTY_DEED_WORKFLOW,
            identityVerified: true,
            applicationNumber: '123456',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.updateCase).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflow: expect.objectContaining({
            identityVerified: true,
            applicationNumber: '123456',
          }),
        }),
      })
    );
  });
});
