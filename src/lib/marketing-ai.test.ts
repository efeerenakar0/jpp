import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  decryptCompanyApiKey: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  default: {
    companyAiCredential: {
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock('@/lib/company-ai-credentials', () => ({
  companyApiKeyHint: vi.fn(),
  decryptCompanyApiKey: mocks.decryptCompanyApiKey,
  encryptCompanyApiKey: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({ callAI: vi.fn() }));

import {
  buildOpenRouterRequestBody,
  callCompanyMarketingAI,
} from './marketing-ai';

const messages = [{ role: 'user' as const, content: 'Sahne planı oluştur.' }];

describe('buildOpenRouterRequestBody', () => {
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

describe('callCompanyMarketingAI', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('model JSON modunu reddederse aynı şirket anahtarıyla normal isteği dener', async () => {
    mocks.findUnique.mockResolvedValue({
      active: true,
      encryptedApiKey: 'encrypted',
      keyHint: '...1234',
      model: 'openrouter/free',
    });
    mocks.decryptCompanyApiKey.mockReturnValue('sk-or-test-key');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'response_format desteklenmiyor' } }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary":"geçerli"}' } }],
          }),
          { status: 200 }
        )
      );
    global.fetch = fetchMock;

    const result = await callCompanyMarketingAI('company-a', messages, {
      jsonMode: true,
    });

    expect(result).toMatchObject({
      provider: 'OPENROUTER',
      content: '{"summary":"geçerli"}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toHaveProperty(
      'response_format'
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).not.toHaveProperty(
      'response_format'
    );
  });
});
