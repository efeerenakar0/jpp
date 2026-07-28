import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { callAI, sharedAssistantAIStatus } from './ai';

describe('AI router', () => {
  const originalFetch = global.fetch;
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalCloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const originalCloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk_test-key-with-enough-characters';
    process.env.CLOUDFLARE_API_TOKEN = 'cloudflare-test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cloudflare-account-id';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqKey;
    if (originalCloudflareToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = originalCloudflareToken;
    }
    if (originalCloudflareAccountId === undefined) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalCloudflareAccountId;
    }
    vi.restoreAllMocks();
  });

  it('uses the multilingual Groq model first for marketing requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"title":"Wohnung in Alanya"}' } }],
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    const result = await callAI(
      [{ role: 'user', content: 'Almanca emlak ilanı üret' }],
      'marketing-international'
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).model).toBe('qwen/qwen3.6-27b');
    expect(result).toMatchObject({
      provider: 'GROQ',
      model: 'qwen/qwen3.6-27b',
      isMock: false,
    });
  });

  it('uses the production Groq model first for assistant requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Size uygun bir portföy buldum.' } }],
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    const result = await callAI(
      [{ role: 'user', content: 'Mahmutlar portföylerini göster' }],
      'whatsapp-customer-assistant'
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).model).toBe('openai/gpt-oss-120b');
    expect(result.model).toBe('openai/gpt-oss-120b');
  });

  it('falls back to Cloudflare Workers AI when Groq models fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'temporary error' } }), {
          status: 503,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'temporary error' } }), {
          status: 503,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: { response: 'Cloudflare yanıtı' },
          }),
          { status: 200 }
        )
      );
    global.fetch = fetchMock;

    const result = await callAI(
      [{ role: 'user', content: 'Kısa bir yanıt üret' }],
      'general-manager'
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      '/ai/run/@cf/qwen/qwen3-30b-a3b-fp8'
    );
    expect(result).toMatchObject({
      content: 'Cloudflare yanıtı',
      provider: 'CLOUDFLARE',
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
    });
  });

  it('reports both configured providers without exposing credentials', () => {
    expect(sharedAssistantAIStatus()).toEqual({
      configured: true,
      provider: 'Jasmine AI Router',
      model: 'GPT-OSS 120B · Qwen 3.6 · Cloudflare Qwen3',
      providers: {
        groq: true,
        cloudflare: true,
      },
    });
  });
});
