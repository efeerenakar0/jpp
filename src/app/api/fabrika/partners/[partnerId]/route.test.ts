import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requirePrincipal: vi.fn(),
  requireOwner: vi.fn(),
  getPartner: vi.fn(),
  updatePartnerStage: vi.fn(),
  partnerApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Hata' },
      { status: 403 }
    )
  ),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requirePrincipal,
  requireFabrikaOwner: mocks.requireOwner,
}));

vi.mock('@/lib/partner-outreach/api', () => ({
  partnerApiError: mocks.partnerApiError,
}));

vi.mock('@/lib/partner-outreach/service', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('@/lib/partner-outreach/service')
  >();
  return {
    ...original,
    getPartner: mocks.getPartner,
    updatePartnerStage: mocks.updatePartnerStage,
  };
});

import { GET, PATCH } from './route';

describe('/api/fabrika/partners/[partnerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPartner.mockResolvedValue({ id: 'partner-1' });
    mocks.updatePartnerStage.mockResolvedValue({
      id: 'partner-1',
      stage: 'ACTIVE',
    });
  });

  it('çalışana ticari anlaşma ve komisyon ayrıntılarını sorgulatmaz', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'EMPLOYEE',
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });

    const response = await GET(
      new Request('https://example.test/api/fabrika/partners/partner-1'),
      { params: Promise.resolve({ partnerId: 'partner-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.getPartner).toHaveBeenCalledWith(
      'company-a',
      'partner-1',
      { includeCommercialDetails: false }
    );
  });

  it('patrona anlaşma ve komisyon ayrıntılarını gösterebilir', async () => {
    mocks.requirePrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });

    await GET(
      new Request('https://example.test/api/fabrika/partners/partner-1'),
      { params: Promise.resolve({ partnerId: 'partner-1' }) }
    );

    expect(mocks.getPartner).toHaveBeenCalledWith(
      'company-a',
      'partner-1',
      { includeCommercialDetails: true }
    );
  });

  it('kritik partner durumunu yalnız patronun değiştirmesine izin verir', async () => {
    mocks.requireOwner.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });

    const response = await PATCH(
      new Request('https://example.test/api/fabrika/partners/partner-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'ACTIVE', reason: 'Sözleşme onaylandı' }),
      }),
      { params: Promise.resolve({ partnerId: 'partner-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.requireOwner).toHaveBeenCalledTimes(1);
    expect(mocks.requirePrincipal).not.toHaveBeenCalled();
    expect(mocks.updatePartnerStage).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        partnerId: 'partner-1',
        stage: 'ACTIVE',
        actorType: 'OWNER',
        actorId: 'company-a',
      })
    );
  });

  it('patron doğrulaması başarısızsa hiçbir durum değişikliği yapmaz', async () => {
    mocks.requireOwner.mockRejectedValue(new Error('Yalnız patron'));

    const response = await PATCH(
      new Request('https://example.test/api/fabrika/partners/partner-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'ARCHIVED' }),
      }),
      { params: Promise.resolve({ partnerId: 'partner-1' }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.updatePartnerStage).not.toHaveBeenCalled();
  });
});
