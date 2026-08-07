import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaOwner: vi.fn(),
  getCompanySettings: vi.fn(),
  saveCompanySettings: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/fabrika-session')>();
  return {
    ...original,
    requireFabrikaOwner: mocks.requireFabrikaOwner,
  };
});

vi.mock('@/lib/company-settings-service', () => ({
  getCompanySettings: mocks.getCompanySettings,
  saveCompanySettings: mocks.saveCompanySettings,
}));

import { FabrikaForbiddenError } from '@/lib/fabrika-session';
import { defaultCompanySettings } from '@/lib/company-settings';
import { GET, PATCH } from './route';

describe('/api/fabrika/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaOwner.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.getCompanySettings.mockResolvedValue({
      settings: defaultCompanySettings('Akar Group'),
      completed: false,
      members: [],
    });
    mocks.saveCompanySettings.mockResolvedValue({
      settings: defaultCompanySettings('Akar Group'),
      completed: false,
      members: [],
    });
  });

  it('GET sorgusunu yalnız oturumdaki şirket kimliğiyle yapar', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getCompanySettings).toHaveBeenCalledWith('company-a');
  });

  it('çalışanın patron ayarlarını değiştirmesine izin vermez', async () => {
    mocks.requireFabrikaOwner.mockRejectedValue(
      new FabrikaForbiddenError('Yalnız patron')
    );

    const response = await PATCH(
      new Request('https://app.test/api/fabrika/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(defaultCompanySettings('Akar Group')),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.saveCompanySettings).not.toHaveBeenCalled();
  });

  it('bilinmeyen secret alanını reddeder ve DB mutasyonu yapmaz', async () => {
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...defaultCompanySettings('Akar Group'),
          apiKey: 'must-not-enter-settings',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.saveCompanySettings).not.toHaveBeenCalled();
  });

  it('doğrulanmış payloadı tenant ve sunucu saatiyle servise yollar', async () => {
    const payload = defaultCompanySettings('Akar Group');
    const response = await PATCH(
      new Request('https://app.test/api/fabrika/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.saveCompanySettings).toHaveBeenCalledWith(
      'company-a',
      payload,
      expect.any(Date)
    );
  });
});
