import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  enhanceWithStableImageUltra: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class MockFabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/stability-ultra', () => ({
  StabilityUltraError: class MockStabilityUltraError extends Error {},
  enhanceWithStableImageUltra: mocks.enhanceWithStableImageUltra,
}));

vi.mock('@/lib/studio-enhancement', () => ({
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT: 'Varsayılan yeniden üretim talimatı',
}));

vi.mock('@/lib/studio-store', () => ({
  getOrCreateSession: vi.fn(),
}));

import { POST } from './route';

function directProcessRequest(type = 'image/jpeg') {
  const form = new FormData();
  form.append(
    'photo',
    new File([Uint8Array.from([255, 216, 255, 217])], 'salon.jpg', {
      type,
    })
  );
  form.append('prompt', 'Bu salonu lüks bir emlak çekimi olarak baştan oluştur.');
  return new Request('https://app.test/api/fabrika/studio/process', {
    method: 'POST',
    body: form,
  });
}

describe('direct Stable Image Ultra processing route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: { id: 'company-a' },
    });
    mocks.enhanceWithStableImageUltra.mockResolvedValue({
      buffer: Buffer.from([255, 216, 0, 255, 217]),
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('processes one uploaded image and returns the generated image bytes directly', async () => {
    const response = await POST(directProcessRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('x-studio-filename')).toBe(
      'salon_AI_yeniden_olusturuldu.jpg'
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      Uint8Array.from([255, 216, 0, 255, 217])
    );
    expect(mocks.enhanceWithStableImageUltra).toHaveBeenCalledWith({
      image: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
      prompt: 'Bu salonu lüks bir emlak çekimi olarak baştan oluştur.',
    });
  });

  it('rejects unsupported image formats before calling the provider', async () => {
    const response = await POST(directProcessRequest('image/gif'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_IMAGE');
    expect(mocks.enhanceWithStableImageUltra).not.toHaveBeenCalled();
  });
});
