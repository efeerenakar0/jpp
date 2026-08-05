import { describe, expect, it } from 'vitest';
import {
  isPlatformStudioAiReady,
  isPlatformTextAiReady,
} from './platform-ai-readiness';

describe('platform AI readiness', () => {
  it('metin servisini yalnız platform ortam anahtarlarıyla hazır sayar', () => {
    expect(isPlatformTextAiReady({ GROQ_API_KEY: 'gsk_platform-secret' })).toBe(true);
    expect(
      isPlatformTextAiReady({
        CLOUDFLARE_API_TOKEN: 'cf-platform-token',
        CLOUDFLARE_ACCOUNT_ID: 'account-id',
      })
    ).toBe(true);
    expect(isPlatformTextAiReady({ CLOUDFLARE_API_TOKEN: 'token-only' })).toBe(false);
    expect(isPlatformTextAiReady({})).toBe(false);
  });

  it('stüdyo servisini yalnız platform Stability anahtarıyla hazır sayar', () => {
    expect(isPlatformStudioAiReady({ STABILITY_API_KEY: 'sk-platform-stability' })).toBe(true);
    expect(isPlatformStudioAiReady({ STABILITY_API_KEY: '   ' })).toBe(false);
    expect(isPlatformStudioAiReady({})).toBe(false);
  });
});
