import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildBannerbearModifications,
  generateBannerbearPoster,
} from './bannerbear-poster';
import { defaultBannerbearPreset } from './bannerbear-poster-catalog';

const facts = {
  companyName: 'Jasmine Group',
  headline: 'Alanya’da Deniz Manzaralı Villa',
  summary: 'Özel havuzlu, ferah ve modern yaşam alanı.',
  callToAction: 'Detaylı bilgi için bize ulaşın',
  location: 'Antalya / Alanya',
  roomCount: '3+1',
  area: '180',
  price: '9.300.000 TL',
  propertyType: 'Villa',
  highlights: ['Özel havuz', 'Deniz manzarası'],
  contactPhone: '+90 555 123 45 67',
};

describe('buildBannerbearModifications', () => {
  it('doğrulanmış ilan bilgilerini doğru şablon katmanlarına yerleştirir', () => {
    const result = buildBannerbearModifications({
      objects: [
        { name: 'title', type: 'text' },
        { name: 'location', type: 'text' },
        { name: 'price', type: 'text' },
        { name: 'bedrooms', type: 'text' },
        { name: 'bathrooms', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'contact_details', type: 'text' },
        { name: 'image_container', type: 'image' },
        { name: 'logo', type: 'image' },
      ],
      facts,
      imageUrls: ['https://blob.example/villa.jpg'],
      logoUrl: 'https://blob.example/logo.png',
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'title', text: facts.headline, 'text-fit': 'auto_fit' }),
        expect.objectContaining({ name: 'location', text: facts.location, 'text-fit': 'auto_fit' }),
        expect.objectContaining({ name: 'price', text: facts.price, 'text-fit': 'auto_fit' }),
        expect.objectContaining({ name: 'bedrooms', text: '3+1 Oda' }),
        { name: 'bathrooms', hidden: true },
        expect.objectContaining({ name: 'description', text: facts.summary }),
        expect.objectContaining({
          name: 'contact_details',
          text: `Bilgi ve randevu: ${facts.contactPhone}`,
        }),
        expect.objectContaining({
          name: 'image_container',
          'background-image': 'https://blob.example/villa.jpg',
          'background-size': 'cover',
        }),
        expect.objectContaining({
          name: 'logo',
          'background-image': 'https://blob.example/logo.png',
          'background-size': 'contain',
        }),
      ])
    );
  });

  it('eksik fotoğraf ve logo alanlarını tekrar kullanmak yerine gizler', () => {
    const result = buildBannerbearModifications({
      objects: [
        { name: 'image_container_1', type: 'image' },
        { name: 'image_container_2', type: 'image' },
        { name: 'logo', type: 'image' },
      ],
      facts,
      imageUrls: ['https://blob.example/only-photo.jpg'],
      logoUrl: null,
    });

    expect(result).toEqual([
      expect.objectContaining({
        name: 'image_container_1',
        'background-image': 'https://blob.example/only-photo.jpg',
      }),
      { name: 'image_container_2', hidden: true },
      { name: 'logo', hidden: true },
    ]);
  });
});

describe('generateBannerbearPoster', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('V5 üst seviye katman yanıtını işler, şablon renklerini bozmaz ve profesyonel 4:5 çıktı hazırlar', async () => {
    const preset = defaultBannerbearPreset('post');
    const rendered = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: '#17324f',
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="800" height="800"><rect x="80" y="80" width="640" height="420" fill="#d7b56d"/><rect x="140" y="560" width="520" height="120" fill="#f5f1e8"/></svg>'
          ),
        },
      ])
      .jpeg()
      .toBuffer();
    let submittedBody: {
      modifications?: { objects?: Array<Record<string, unknown>> };
    } = {};
    const fetchMock = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url.endsWith(`/image_templates/${preset.templateUid}`)) {
        return Response.json({
          uid: preset.templateUid,
          width: 800,
          height: 800,
          objects: [
            { name: 'title', type: 'text', color: '#ffffff' },
            { name: 'price', type: 'text', color: '#e8c273' },
            { name: 'image_container', type: 'image_container' },
          ],
        });
      }
      if (url.endsWith('/images') && init?.method === 'POST') {
        submittedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json({ uid: 'render-1', status: 'pending' }, { status: 202 });
      }
      if (url.endsWith('/images/render-1')) {
        return Response.json({
          uid: 'render-1',
          status: 'completed',
          files: { jpg: 'https://images.bannerbear.com/render-1.jpg' },
        });
      }
      if (url === 'https://images.bannerbear.com/render-1.jpg') {
        return new Response(new Uint8Array(rendered), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      return Response.json({ message: 'not found' }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateBannerbearPoster({
      apiKey: 'test-key',
      templateUid: preset.templateUid,
      presetId: preset.id,
      format: 'post',
      outputSize: 'portrait',
      imageUrls: ['https://cdn.example.test/property.jpg'],
      facts,
      metadata: 'test-render',
    });

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
    const objects = submittedBody.modifications?.objects || [];
    const title = objects.find((item) => item.name === 'title');
    expect(title).toMatchObject({
      text: facts.headline,
      'text-fit': 'auto_fit',
    });
    expect(title).not.toHaveProperty('color');
    expect(objects.find((item) => item.name === 'image_container')).toMatchObject({
      'background-image': 'https://cdn.example.test/property.jpg',
      'background-size': 'cover',
    });
  });
});
