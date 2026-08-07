import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { generatePortfolioRemotionProgram } from './openrouter-video-generator';

const plan = {
  schemaVersion: 1,
  creativeSeed: 42,
  format: '9:16',
  durationSeconds: 15,
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { background: '#020817', surface: '#0b1728', text: '#ffffff', accent: '#22d3ee', font: 'MODERN' },
  scenes: [
    { id: 'hero', helper: 'Hero', startFrame: 0, durationInFrames: 150, assetIds: ['media-1'], factRefs: ['TITLE'], headline: 'Yeni yaşam', body: null, motion: 'ZOOM_IN', transition: 'FADE', layout: 'FULL' },
    { id: 'gallery', helper: 'PropertyImage', startFrame: 150, durationInFrames: 150, assetIds: ['media-1'], factRefs: ['LOCATION'], headline: 'Konumu keşfedin', body: null, motion: 'PAN_LEFT', transition: 'SLIDE', layout: 'FULL' },
    { id: 'outro', helper: 'LogoOutro', startFrame: 300, durationInFrames: 150, assetIds: [], factRefs: ['COMPANY_NAME'], headline: 'Detaylar için ulaşın', body: null, motion: 'STILL', transition: 'FADE', layout: 'CENTER' },
  ],
};

function program(codeSuffix = '') {
  return JSON.stringify({
    plan,
    code: `import React from 'react'; import { AbsoluteFill } from 'remotion'; import { GeneratedVideoRuntime } from '@business-ceo/video-runtime'; export const videoPlan = ${JSON.stringify(plan)}; export default function Video({facts}: {facts: unknown}){ return <AbsoluteFill><GeneratedVideoRuntime plan={videoPlan} facts={facts} /></AbsoluteFill>; } ${codeSuffix}`,
  });
}

function response(content: string, status = 200) {
  return new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content } }] }) : '{}', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const input = {
  creativeSeed: 42,
  format: '9:16' as const,
  durationSeconds: 15 as const,
  prompt: 'Lüks ve dikkat çekici yap',
  portfolio: {
    title: 'Kestel Daire', referenceCode: 'P-104', location: 'Kestel', priceLabel: '5.250.000 TL', roomCount: '2+1', areaLabel: '110 m²', description: 'Deniz manzaralı', features: ['Deniz manzarası'], companyName: 'Business CEO AI', assets: [{ assetId: 'media-1', index: 0, isCover: true, width: 1200, height: 800 }],
  },
};

describe('OpenRouter Remotion generator fallback', () => {
  it('gives the model the exact scene contract instead of an ambiguous prose schema', async () => {
    const requestBodies: Array<{ messages?: Array<{ content?: string }> }> = [];
    const fetcher = vi.fn().mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return response(program());
    });

    await generatePortfolioRemotionProgram(input, {
      apiKey: 'server-secret', fetcher, sleep: vi.fn(),
    });

    const systemMessage = requestBodies[0]?.messages?.[0]?.content ?? '';
    expect(systemMessage).toContain('startFrame');
    expect(systemMessage).toContain('durationInFrames');
    expect(systemMessage).toContain('assetIds');
    expect(systemMessage).toContain('headline');
    expect(systemMessage).toContain('theme');
    expect(systemMessage).toContain('type, duration, globalStart');
  });

  it('uses the primary free model when output validates', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(program()));
    const result = await generatePortfolioRemotionProgram(input, {
      apiKey: 'server-secret', fetcher, sleep: vi.fn(),
    });
    expect(result.model).toBe('poolside/laguna-s-2.1:free');
    expect(result.attempts).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses the free fixer and then the paid fallback at most once', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(program("fetch('https://evil.test')")))
      .mockResolvedValueOnce(response('{"bad":true}'))
      .mockResolvedValueOnce(response(program()));
    const result = await generatePortfolioRemotionProgram(input, {
      apiKey: 'server-secret', fetcher, sleep: vi.fn(),
    });
    expect(result.model).toBe('qwen/qwen3-coder-next');
    expect(result.attempts.map((attempt) => attempt.model)).toEqual([
      'poolside/laguna-s-2.1:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'qwen/qwen3-coder-next',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('retries 429 once without leaking the key in the error', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('', 429))
      .mockResolvedValueOnce(response(program()));
    const result = await generatePortfolioRemotionProgram(input, { apiKey: 'server-secret', fetcher, sleep });
    expect(result.model).toContain(':free');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('caller aborts the request without trying fixer or paid fallback models', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_url: Parameters<typeof fetch>[0], init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Request aborted', 'AbortError')),
          { once: true },
        );
      }),
    );

    const pending = generatePortfolioRemotionProgram(input, {
      apiKey: 'server-secret',
      fetcher: fetcher as typeof fetch,
      sleep: vi.fn(),
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects code whose embedded plan differs from the validated JSON plan', async () => {
    const alteredPlan = { ...plan, creativeSeed: 43 };
    const mismatched = JSON.stringify({
      plan,
      code: `import React from 'react'; import { AbsoluteFill } from 'remotion'; import { GeneratedVideoRuntime } from '@business-ceo/video-runtime'; export const videoPlan = ${JSON.stringify(alteredPlan)}; export default function Video({facts}: {facts: unknown}){ return <AbsoluteFill><GeneratedVideoRuntime plan={videoPlan} facts={facts} /></AbsoluteFill>; }`,
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(mismatched))
      .mockResolvedValueOnce(response(program()));

    const result = await generatePortfolioRemotionProgram(input, {
      apiKey: 'server-secret', fetcher, sleep: vi.fn(),
    });

    expect(result.model).toBe('nvidia/nemotron-3-super-120b-a12b:free');
    expect(result.attempts[0]?.error).toContain('uyuşmuyor');
  });
});
