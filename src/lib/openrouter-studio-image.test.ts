import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildRealEstateEnhancementPrompt,
  enhanceWithOpenRouterFluxKlein,
  enhanceWithOpenRouterGptImage2,
  enhanceWithOpenRouterStudioImage,
  OpenRouterStudioImageError,
} from './openrouter-studio-image';

function referenceEchoFetch(capture?: (body: Record<string, unknown>) => void) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      input_references: Array<{ image_url: { url: string } }>;
    } & Record<string, unknown>;
    capture?.(body);
    const encoded = body.input_references[0].image_url.url.split(',')[1];
    return Response.json({ data: [{ b64_json: encoded }] });
  });
}

describe('OpenRouter Studio image adapter', () => {
  it.runIf(process.env.OPENROUTER_STUDIO_LIVE_TEST === '1')(
    'completes one real low-quality image edit through OpenRouter',
    async () => {
      const source = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: '#758896',
        },
      })
        .jpeg()
        .toBuffer();

      const result = await enhanceWithOpenRouterStudioImage({
        image: source,
        mimeType: 'image/jpeg',
        prompt: 'Keep the exact frame and make only a subtle natural exposure correction.',
      });

      expect(result.buffer.length).toBeGreaterThan(1_000);
      expect(result).toMatchObject({
        width: 1024,
        height: 1024,
        model: 'openai/gpt-image-1-mini',
      });
    },
    300_000
  );

  it('uses the official image endpoint with low quality, n=1 and one reference', async () => {
    const source = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: '#5f7180',
      },
    })
      .jpeg()
      .toBuffer();
    let requestBody: Record<string, unknown> | undefined;
    let referenceSize: { width?: number; height?: number } | undefined;
    const fetchImpl = referenceEchoFetch((body) => {
      requestBody = body;
      const reference = body.input_references as Array<{
        image_url: { url: string };
      }>;
      const encoded = reference[0].image_url.url.split(',')[1];
      referenceSize = undefined;
      void sharp(Buffer.from(encoded, 'base64'))
        .metadata()
        .then((metadata) => {
          referenceSize = {
            width: metadata.width,
            height: metadata.height,
          };
        });
    });

    const result = await enhanceWithOpenRouterStudioImage({
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Doğal ışık.',
      apiKey: 'test-openrouter-key',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/images',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openrouter-key',
        }),
      })
    );
    expect(requestBody).toMatchObject({
      model: 'openai/gpt-image-1-mini',
      quality: 'low',
      n: 1,
      aspect_ratio: '3:2',
    });
    expect(requestBody?.input_references).toHaveLength(1);
    await vi.waitFor(() => {
      expect(referenceSize).toEqual({ width: 1080, height: 720 });
    });
    expect(result).toMatchObject({
      width: 1080,
      height: 720,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      model: 'openai/gpt-image-1-mini',
    });
  });

  it('keeps the larger output ceiling separate from the cheaper reference copy', async () => {
    const source = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: '#61788a',
      },
    })
      .jpeg()
      .toBuffer();
    const providerOutput = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: '#71899b',
      },
    })
      .jpeg()
      .toBuffer();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [{ b64_json: providerOutput.toString('base64') }],
      })
    );

    const result = await enhanceWithOpenRouterStudioImage({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toMatchObject({ width: 1620, height: 1080 });
  });

  it('keeps square images square and caps them at 1024x1024 without cropping', async () => {
    const source = await sharp({
      create: {
        width: 1800,
        height: 1800,
        channels: 3,
        background: '#8b745f',
      },
    })
      .png()
      .toBuffer();

    const result = await enhanceWithOpenRouterStudioImage({
      image: source,
      mimeType: 'image/png',
      apiKey: 'test-openrouter-key',
      fetchImpl: referenceEchoFetch() as typeof fetch,
    });

    expect(result).toMatchObject({ width: 1024, height: 1024 });
  });

  it('uses a temporary 3:2 matte for a 16:9 Mini edit and restores 16:9', async () => {
    const source = await sharp({
      create: {
        width: 2560,
        height: 1440,
        channels: 3,
        background: '#536979',
      },
    })
      .jpeg()
      .toBuffer();
    const miniOutput = await sharp({
      create: {
        width: 1536,
        height: 1024,
        channels: 3,
        background: '#637989',
      },
    })
      .jpeg()
      .toBuffer();
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        data: [{ b64_json: miniOutput.toString('base64') }],
      });
    });

    const result = await enhanceWithOpenRouterStudioImage({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(requestBody).toMatchObject({
      model: 'openai/gpt-image-1-mini',
      aspect_ratio: '3:2',
    });
    expect(result.width / result.height).toBeCloseTo(16 / 9, 2);
    expect(result).toMatchObject({ width: 1536, height: 864 });
  });

  it('refuses a provider result that changes the source composition ratio', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: '#4e6474',
      },
    })
      .jpeg()
      .toBuffer();
    const square = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: '#4e6474',
      },
    })
      .jpeg()
      .toBuffer();
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: [{ b64_json: square.toString('base64') }] })
    );

    await expect(
      enhanceWithOpenRouterStudioImage({
        image: source,
        mimeType: 'image/jpeg',
        apiKey: 'test-openrouter-key',
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toMatchObject({
      code: 'COMPOSITION_CHANGED',
    } satisfies Partial<OpenRouterStudioImageError>);
  });

  it('builds strict preservation instructions and never authorizes staging', () => {
    const prompt = buildRealEstateEnhancementPrompt('Make it naturally brighter.');
    expect(prompt).toContain('not through a broad global exposure increase');
    expect(prompt).toContain('A night or blue-hour photograph must remain night');
    expect(prompt).toContain('Prefer subtle local lighting');
    expect(prompt).toContain('may be switched on or made gently more attractive');
    expect(prompt).toContain('Do not add new light fixtures');
    expect(prompt).toContain('Protect all highlight detail in windows');
    expect(prompt).toContain('Do not add, remove, replace, move, redesign, stage');
    expect(prompt).toContain('exact room, building, furniture, objects');
    expect(prompt).toContain('Make it naturally brighter.');
    expect(prompt).toContain('Ignore any optional preference that asks for strong global brightening');
    expect(prompt).not.toContain('feel brighter, more spacious');
  });

  it('keeps a subtle FLUX lighting lift without adding another Sharp exposure boost', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
    const subtlyLit = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer();
    const result = await enhanceWithOpenRouterFluxKlein({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: vi.fn(async () =>
        Response.json({ data: [{ b64_json: subtlyLit.toString('base64') }] })
      ) as typeof fetch,
    });

    const stats = await sharp(result.buffer).greyscale().stats();
    expect(stats.channels[0].mean).toBeGreaterThan(125);
    expect(stats.channels[0].mean).toBeLessThanOrEqual(130);
  });

  it('tones down a moderately over-bright provider result before saving it', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
    const providerOutput = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 170, g: 170, b: 170 },
      },
    })
      .jpeg()
      .toBuffer();
    const result = await enhanceWithOpenRouterFluxKlein({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: vi.fn(async () =>
        Response.json({ data: [{ b64_json: providerOutput.toString('base64') }] })
      ) as typeof fetch,
    });

    const stats = await sharp(result.buffer).greyscale().stats();
    expect(stats.channels[0].mean).toBeGreaterThan(130);
    expect(stats.channels[0].mean).toBeLessThan(145);
  });

  it('recovers a bright FLUX result for a warm dim source instead of rejecting it', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 105, g: 84, b: 64 },
      },
    })
      .jpeg()
      .toBuffer();
    const providerOutput = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 165, g: 150, b: 135 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await enhanceWithOpenRouterFluxKlein({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: vi.fn(async () =>
        Response.json({ data: [{ b64_json: providerOutput.toString('base64') }] })
      ) as typeof fetch,
    });

    const stats = await sharp(result.buffer).greyscale().stats();
    expect(stats.channels[0].mean).toBeGreaterThan(95);
    expect(stats.channels[0].mean).toBeLessThan(125);
  });

  it('restores a restrained amount of FLUX color and contrast without shifting exposure', async () => {
    const mutedScene = await sharp(
      Buffer.from(`
        <svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="900" fill="rgb(80,70,60)" />
          <rect x="800" width="800" height="900" fill="rgb(170,150,130)" />
        </svg>
      `)
    )
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toBuffer();
    const result = await enhanceWithOpenRouterFluxKlein({
      image: mutedScene,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: vi.fn(async () =>
        Response.json({ data: [{ b64_json: mutedScene.toString('base64') }] })
      ) as typeof fetch,
    });

    const [beforeColor, afterColor, beforeLuma, afterLuma] = await Promise.all([
      sharp(mutedScene).stats(),
      sharp(result.buffer).stats(),
      sharp(mutedScene).greyscale().stats(),
      sharp(result.buffer).greyscale().stats(),
    ]);
    const channelSpread = (stats: Awaited<ReturnType<sharp.Sharp['stats']>>) =>
      Math.max(...stats.channels.slice(0, 3).map((channel) => channel.mean)) -
      Math.min(...stats.channels.slice(0, 3).map((channel) => channel.mean));

    expect(channelSpread(afterColor)).toBeGreaterThan(channelSpread(beforeColor));
    expect(afterLuma.channels[0].stdev).toBeGreaterThan(
      beforeLuma.channels[0].stdev
    );
    expect(
      Math.abs(afterLuma.channels[0].mean - beforeLuma.channels[0].mean)
    ).toBeLessThanOrEqual(2);
  });

  it('rejects a grossly blown-out provider result instead of saving it', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
    const blownOut = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 252, g: 252, b: 252 },
      },
    })
      .jpeg()
      .toBuffer();

    await expect(
      enhanceWithOpenRouterFluxKlein({
        image: source,
        mimeType: 'image/jpeg',
        apiKey: 'test-openrouter-key',
        fetchImpl: vi.fn(async () =>
          Response.json({ data: [{ b64_json: blownOut.toString('base64') }] })
        ) as typeof fetch,
      })
    ).rejects.toMatchObject({
      code: 'EXPOSURE_CHANGED',
    } satisfies Partial<OpenRouterStudioImageError>);
  });

  it('uses GPT Image 2 only when the premium adapter is explicit', async () => {
    const source = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: '#536979',
      },
    })
      .jpeg()
      .toBuffer();
    let requestBody: Record<string, unknown> | undefined;

    const result = await enhanceWithOpenRouterGptImage2({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: referenceEchoFetch((body) => {
        requestBody = body;
      }) as typeof fetch,
    });

    expect(requestBody).toMatchObject({
      model: 'openai/gpt-image-2',
      quality: 'low',
      n: 1,
    });
    expect(result.model).toBe('openai/gpt-image-2');
  });

  it('routes FLUX.2 Klein to Black Forest Labs without OpenAI-only quality', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: '#536979',
      },
    })
      .jpeg()
      .toBuffer();
    let requestBody: Record<string, unknown> | undefined;

    const result = await enhanceWithOpenRouterFluxKlein({
      image: source,
      mimeType: 'image/jpeg',
      apiKey: 'test-openrouter-key',
      fetchImpl: referenceEchoFetch((body) => {
        requestBody = body;
      }) as typeof fetch,
    });

    expect(requestBody).toMatchObject({
      model: 'black-forest-labs/flux.2-klein-4b',
      n: 1,
      aspect_ratio: 'auto',
      provider: {
        only: ['black-forest-labs'],
        allow_fallbacks: false,
      },
    });
    expect(requestBody).not.toHaveProperty('quality');
    expect(result.model).toBe('black-forest-labs/flux.2-klein-4b');
  });
});
