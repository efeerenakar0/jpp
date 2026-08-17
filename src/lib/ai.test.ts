import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { callAI, sharedAssistantAIStatus } from './ai';

describe('AI router', () => {
  const originalFetch = global.fetch;
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  const originalWhatsAppOpenRouterKey =
    process.env.OPENROUTER_WHATSAPP_API_KEY;
  const originalOpenRouterModel = process.env.OPENROUTER_TEXT_MODEL;
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalCloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const originalCloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_WHATSAPP_API_KEY;
    delete process.env.OPENROUTER_TEXT_MODEL;
    process.env.GROQ_API_KEY = 'gsk_test-key-with-enough-characters';
    process.env.CLOUDFLARE_API_TOKEN = 'cloudflare-test-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cloudflare-account-id';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    if (originalWhatsAppOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_WHATSAPP_API_KEY;
    } else {
      process.env.OPENROUTER_WHATSAPP_API_KEY = originalWhatsAppOpenRouterKey;
    }
    if (originalOpenRouterModel === undefined) delete process.env.OPENROUTER_TEXT_MODEL;
    else process.env.OPENROUTER_TEXT_MODEL = originalOpenRouterModel;
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

  it('uses the shared OpenRouter gateway first when configured', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'OpenRouter satış yanıtı' } }],
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    const result = await callAI(
      [{ role: 'user', content: 'Mahmutlar portföylerini göster' }],
      'whatsapp-customer-assistant'
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
      'openai/gpt-oss-120b'
    );
    expect(result).toMatchObject({
      provider: 'OPENROUTER',
      model: 'openai/gpt-oss-120b',
      content: 'OpenRouter satış yanıtı',
    });
  });

  it('prefers the dedicated WhatsApp OpenRouter key for customer replies', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-general-test-key';
    process.env.OPENROUTER_WHATSAPP_API_KEY = 'sk-or-v1-whatsapp-test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'WhatsApp yanıtı' } }],
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    await callAI(
      [{ role: 'user', content: 'Bilgi alabilir miyim?' }],
      'whatsapp-customer-assistant'
    );

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer sk-or-v1-whatsapp-test-key'
    );
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

  it('accepts structured JSON returned by Cloudflare Workers AI', async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            response: {
              summary: 'Özel sahne planı',
              scenes: [{ type: 'HOOK' }],
            },
          },
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    const result = await callAI(
      [{ role: 'user', content: 'Sahne planı üret' }],
      'marketing-video-director'
    );

    expect(result).toMatchObject({
      provider: 'CLOUDFLARE',
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
    });
    expect(JSON.parse(result.content)).toEqual({
      summary: 'Özel sahne planı',
      scenes: [{ type: 'HOOK' }],
    });
  });

  it('reports both configured providers without exposing credentials', () => {
    expect(sharedAssistantAIStatus()).toEqual({
      configured: true,
      provider: 'Business CEO AI Router',
      model: 'OpenRouter GPT-OSS 120B · Groq · Cloudflare Qwen3',
      providers: {
        openrouter: false,
        groq: true,
        cloudflare: true,
      },
    });
  });
});
