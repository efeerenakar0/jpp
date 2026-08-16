import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  createStudioBatch: vi.fn(),
  studioBatchFingerprint: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/property-media-http', () => ({
  propertyMediaHttpError: (error: unknown) => {
    throw error;
  },
}));

vi.mock('@/lib/prisma', () => ({ default: {} }));

vi.mock('@/lib/studio-batches', () => ({
  createStudioBatch: mocks.createStudioBatch,
  studioBatchFingerprint: mocks.studioBatchFingerprint,
}));

import { POST } from './route';

describe('POST /api/fabrika/studio/batches FLUX-only contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    mocks.createStudioBatch.mockResolvedValue({ id: 'batch-a' });
  });

  it('ignores a legacy JSON model override', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': 'request-a',
        },
        body: JSON.stringify({
          prompt: 'Doğal emlak fotoğrafı',
          modelTier: 'PREMIUM',
          uploadedFiles: [],
          mediaIds: ['media-a'],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createStudioBatch).toHaveBeenCalledWith(
      expect.not.objectContaining({ modelTier: expect.anything() })
    );
  });

  it('ignores a legacy multipart model override', async () => {
    const formData = new FormData();
    formData.set('prompt', 'Doğal emlak fotoğrafı');
    formData.set('modelTier', 'STANDARD');
    formData.set('mediaIds', 'media-a');
    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/batches', {
        method: 'POST',
        headers: { 'idempotency-key': 'request-b' },
        body: formData,
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createStudioBatch).toHaveBeenCalledWith(
      expect.not.objectContaining({ modelTier: expect.anything() })
    );
  });
});
