import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/company-ai-credentials', () => ({
  companyApiKeyHint: vi.fn(),
  decryptCompanyApiKey: vi.fn(),
  encryptCompanyApiKey: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({ callAI: vi.fn() }));

import { buildOpenRouterRequestBody } from './marketing-ai';

describe('buildOpenRouterRequestBody', () => {
  const messages = [{ role: 'user' as const, content: 'Sahne planı oluştur.' }];

  it('video yönetmeni için OpenRouter JSON modunu zorunlu kılar', () => {
    expect(
      buildOpenRouterRequestBody('openrouter/free', messages, { jsonMode: true })
    ).toMatchObject({
      model: 'openrouter/free',
      messages,
      response_format: { type: 'json_object' },
    });
  });

  it('normal pazarlama metinlerinde JSON modunu kendiliğinden açmaz', () => {
    expect(buildOpenRouterRequestBody('openrouter/free', messages)).not.toHaveProperty(
      'response_format'
    );
  });
});
