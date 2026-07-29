import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  authorizationCreate: vi.fn(),
  authorizationFindUnique: vi.fn(),
  authorizationUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    companyAccount: {
      findUnique: mocks.accountFindUnique,
    },
    sourceAuthorization: {
      create: mocks.authorizationCreate,
      findUnique: mocks.authorizationFindUnique,
      update: mocks.authorizationUpdate,
    },
  },
}));

import {
  createSourceAuthorization,
  createSourceAuthorizationSchema,
  updateSourceAuthorization,
} from './source-authorization-service';

const validPayload = {
  companyAccountId: 'company-a',
  provider: 'SAHIBINDEN' as const,
  status: 'ACTIVE' as const,
  allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'] as const,
  contractReference: 'agreement-2026-001',
  startsAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

describe('SourceAuthorization yönetimi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({ id: 'company-a' });
    mocks.authorizationCreate.mockResolvedValue({ id: 'authorization-a' });
  });

  it('aktif yetki için zorunlu okuma kapsamlarını ister', () => {
    const result = createSourceAuthorizationSchema.safeParse({
      ...validPayload,
      allowedScopes: ['SEARCH_READ'],
    });
    expect(result.success).toBe(false);
  });

  it('bitiş tarihi başlangıçtan önceyse reddeder', () => {
    const result = createSourceAuthorizationSchema.safeParse({
      ...validPayload,
      expiresAt: '2025-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('tenant hesabını doğrulayıp yetkiyi tekilleştirilmiş kapsamlarla kaydeder', async () => {
    await expect(
      createSourceAuthorization({
        ...validPayload,
        allowedScopes: [
          'SEARCH_READ',
          'DETAIL_READ',
          'MEDIA_READ',
          'MEDIA_READ',
        ],
      })
    ).resolves.toMatchObject({ id: 'authorization-a' });

    expect(mocks.accountFindUnique).toHaveBeenCalledWith({
      where: { id: 'company-a' },
      select: { id: true },
    });
    expect(mocks.authorizationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a',
        allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'],
      }),
    });
  });

  it('süresi dolmuş yetkiyi yeniden aktifleştirmez', async () => {
    mocks.authorizationFindUnique.mockResolvedValue({
      id: 'authorization-a',
      startsAt: new Date('2025-01-01T00:00:00.000Z'),
      expiresAt: new Date('2025-02-01T00:00:00.000Z'),
      allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'],
    });

    await expect(
      updateSourceAuthorization({
        id: 'authorization-a',
        status: 'ACTIVE',
      })
    ).rejects.toThrow('Geçerlilik tarihi');
    expect(mocks.authorizationUpdate).not.toHaveBeenCalled();
  });
});
