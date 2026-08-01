import { describe, expect, it, vi } from 'vitest';

import { resolvePosterBackground } from './studio-poster-client';

describe('poster client fallback', () => {
  it('still returns a local canvas background when the poster API is unavailable', async () => {
    const request = vi.fn().mockRejectedValue(new Error('payload too large'));

    await expect(
      resolvePosterBackground({
        mode: 'faithful',
        localBackgroundUrl: 'blob:local-property-photo',
        request,
      })
    ).resolves.toEqual({
      backgroundUrl: 'blob:local-property-photo',
      effectiveMode: 'faithful',
      fallbackUsed: true,
      warning:
        'Sunucu yanıt vermedi; poster mevcut fotoğrafla yerel kanvasta hazırlandı.',
      logoDataUrl: null,
    });
  });

  it('uses the Ultra background when creative generation succeeds', async () => {
    const request = vi.fn().mockResolvedValue({
      backgroundDataUrl: 'data:image/jpeg;base64,generated',
      fallbackUsed: false,
      logoDataUrl: 'data:image/png;base64,logo',
    });

    await expect(
      resolvePosterBackground({
        mode: 'creative',
        localBackgroundUrl: 'blob:local-property-photo',
        request,
      })
    ).resolves.toEqual({
      backgroundUrl: 'data:image/jpeg;base64,generated',
      effectiveMode: 'creative',
      fallbackUsed: false,
      warning: null,
      logoDataUrl: 'data:image/png;base64,logo',
    });
  });

  it('uses the server-provided original photo and faithful label when the provider falls back', async () => {
    const request = vi.fn().mockResolvedValue({
      backgroundDataUrl: 'data:image/jpeg;base64,fallback-copy',
      fallbackUsed: true,
      warning: 'Sağlayıcı kullanılamadı.',
      logoDataUrl: null,
    });

    await expect(
      resolvePosterBackground({
        mode: 'creative',
        localBackgroundUrl: 'blob:local-property-photo',
        request,
      })
    ).resolves.toEqual({
      backgroundUrl: 'data:image/jpeg;base64,fallback-copy',
      effectiveMode: 'faithful',
      fallbackUsed: true,
      warning: 'Sağlayıcı kullanılamadı.',
      logoDataUrl: null,
    });
  });
});
