import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  generateStudioPosterBackground: vi.fn(),
  companyAccountUpdate: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class MockFabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    companyAccount: {
      update: mocks.companyAccountUpdate,
    },
    crmProperty: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ai', () => ({
  callAI: vi.fn(),
}));

vi.mock('@/lib/studio-image-provider', () => ({
  generateStudioPosterBackground: mocks.generateStudioPosterBackground,
}));

vi.mock('@/lib/stability-ultra', () => ({
  STUDIO_IMAGE_TO_IMAGE_STRENGTH: 0.82,
}));

import { POST } from './route';

function posterRequest(mode: 'faithful' | 'creative') {
  const form = new FormData();
  form.append(
    'photos',
    new File([Uint8Array.from([255, 216, 255, 217])], 'property.jpg', {
      type: 'image/jpeg',
    })
  );
  form.append('mode', mode);
  form.append('format', 'story');
  form.append('companyName', 'Test Emlak');

  return new Request('https://app.test/api/fabrika/studio/poster', {
    method: 'POST',
    body: form,
  });
}

describe('studio poster generation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: {
        id: 'company-a',
        companyName: 'Test Emlak',
        brandLogoData: null,
      },
      permissions: {
        canManageSecrets: false,
      },
    });
  });

  it('keeps the faithful canvas flow without calling an image provider', async () => {
    const response = await POST(posterRequest('faithful'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      mode: 'faithful',
      backgroundSource: 'canvas',
      fallbackUsed: false,
    });
    expect(body.backgroundDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(mocks.generateStudioPosterBackground).not.toHaveBeenCalled();
  });

  it('returns the original canvas image when the creative provider fails', async () => {
    mocks.generateStudioPosterBackground.mockResolvedValue({
      buffer: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
      source: 'canvas-fallback',
      provider: 'stability',
      model: 'Stable Image Ultra',
      fallbackUsed: true,
      fallbackCode: 'RATE_LIMITED',
    });

    const response = await POST(posterRequest('creative'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      mode: 'creative',
      backgroundSource: 'canvas-fallback',
      fallbackUsed: true,
      fallbackCode: 'RATE_LIMITED',
      provider: 'stability',
      providerModel: 'Stable Image Ultra',
    });
    expect(body.warning).toContain('mevcut fotoğraf');
    expect(body.backgroundDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(mocks.generateStudioPosterBackground).toHaveBeenCalledWith(
      expect.objectContaining({ strength: 0.82 })
    );
  });
});
