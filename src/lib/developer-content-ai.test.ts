import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DEVELOPER_CONTENT_AI_MODELS,
  generateDeveloperSiteSection,
} from './developer-content-ai';
import { defaultDeveloperSiteContent } from './developer-site';

describe('developer website content AI', () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('sends the requested free-model fallback order without exposing the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: DEVELOPER_CONTENT_AI_MODELS[1],
          choices: [
            {
              message: {
                content: JSON.stringify({
                  enabled: true,
                  title: 'Bizi yakından tanıyın',
                  body: 'Yerel uzmanlığımızla güvenli bir gayrimenkul deneyimi sunuyoruz.',
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await generateDeveloperSiteSection({
      apiKey: 'sk-or-test-secret',
      brandName: 'Örnek Emlak',
      section: 'about',
      instruction: 'Daha sıcak bir dille yaz',
      currentContent: defaultDeveloperSiteContent('Örnek Emlak'),
      fetchImpl: fetchMock,
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options.body));
    expect(body.models).toEqual(DEVELOPER_CONTENT_AI_MODELS);
    expect(String(options.headers.Authorization)).toBe('Bearer sk-or-test-secret');
    expect(JSON.stringify(body)).not.toContain('sk-or-test-secret');
    expect(result.content.title).toBe('Bizi yakından tanıyın');
  });

  it('fails closed when the server secret is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(
      generateDeveloperSiteSection({
        brandName: 'Örnek Emlak',
        section: 'hero',
        instruction: 'Yeni bir başlık yaz',
        currentContent: defaultDeveloperSiteContent('Örnek Emlak'),
      }),
    ).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
      status: 503,
    });
  });

  it('rejects provider output that does not preserve the section shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"title":"Eksik"}' } }] }),
        { status: 200 },
      ),
    );
    await expect(
      generateDeveloperSiteSection({
        apiKey: 'sk-or-test-secret',
        brandName: 'Örnek Emlak',
        section: 'about',
        instruction: 'Yeniden yaz',
        currentContent: defaultDeveloperSiteContent('Örnek Emlak'),
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
