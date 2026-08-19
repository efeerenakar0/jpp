import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));

import {
  composeAccuratePosterTextLayer,
  generateOpenRouterPoster,
} from './openrouter-poster-image';

describe('generateOpenRouterPoster', () => {
  let source: Buffer;
  let generated: Buffer;

  beforeAll(async () => {
    source = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: '#8d745f',
      },
    })
      .jpeg()
      .toBuffer();
    generated = await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 3,
        background: '#173452',
      },
    })
      .jpeg()
      .toBuffer();
  });

  it('portföy görselini Nano Banana 2 metinsiz kompozisyon isteğine gönderir', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(request).toMatchObject({
        model: 'google/gemini-3.1-flash-image',
        n: 1,
        resolution: '1K',
        aspect_ratio: '4:5',
      });
      expect(request.prompt).toBe('tam poster briefi');
      expect(request.input_references).toEqual([
        {
          type: 'image_url',
          image_url: { url: expect.stringMatching(/^data:image\/jpeg;base64,/) },
        },
      ]);
      return Response.json({
        id: 'generation-a',
        data: [{ b64_json: generated.toString('base64') }],
        usage: { cost: 0.014 },
      });
    });

    const result = await generateOpenRouterPoster({
      references: [{ image: source, mimeType: 'image/jpeg' }],
      prompt: 'tam poster briefi',
      format: 'post',
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      width: 1080,
      height: 1350,
      model: 'google/gemini-3.1-flash-image',
      costUsd: 0.014,
      providerRequestId: 'generation-a',
    });
    await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({
      width: 1080,
      height: 1350,
      format: 'jpeg',
    });
  });

  it('doğrulanmış Türkçe bilgileri sunucuda poster katmanına işler', async () => {
    const result = await composeAccuratePosterTextLayer({
      background: generated,
      format: 'post',
      content: {
        companyName: 'Jasmine & Group',
        posterName: 'Alanya Deniz Manzaralı Villa',
        location: 'Alanya, Antalya',
        roomCount: '3+1',
        propertyType: 'Villa',
        area: '240',
        price: '9.360.000 TL',
        details: 'Yeni yapılmış seçkin portföy',
        highlights: ['Özel havuz'],
        showContact: true,
        showLogo: true,
      },
    });

    expect(result.equals(generated)).toBe(false);
    await expect(sharp(result).metadata()).resolves.toMatchObject({
      width: 1080,
      height: 1350,
      format: 'jpeg',
    });
    const titleRegion = await sharp(result)
      .extract({ left: 88, top: 875, width: 900, height: 190 })
      .stats();
    expect(titleRegion.channels[0].stdev).toBeGreaterThan(20);
  });
});
