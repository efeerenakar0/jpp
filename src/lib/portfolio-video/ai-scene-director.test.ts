import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../marketing-ai', () => ({
  callCompanyMarketingAI: vi.fn(),
}));

import { createCreativeScenePlan } from './ai-scene-director';
import type { PortfolioVideoPortfolio } from './types';

const portfolio: PortfolioVideoPortfolio = {
  id: 'property-a',
  title: 'Kestel Deniz Manzaralı Daire',
  referenceCode: 'P-104',
  location: 'Alanya / Kestel',
  price: 6_500_000,
  roomCount: '3+1',
  area: 165,
  description: 'Geniş balkon ve deniz manzarası.',
  features: ['Geniş balkon', 'Deniz manzarası'],
  status: 'ACTIVE',
  photos: [
    { id: 'a', url: 'https://cdn.test/a.jpg', fileName: 'a.jpg', isCover: true },
    { id: 'b', url: 'https://cdn.test/b.jpg', fileName: 'b.jpg', isCover: false },
    { id: 'c', url: 'https://cdn.test/c.jpg', fileName: 'c.jpg', isCover: false },
  ],
  company: {
    name: 'Jasmine Group',
    logoUrl: null,
    instagramUrl: 'https://instagram.com/jasminegroup',
  },
  advisor: { name: 'Efe Eren', phone: '+905551112233', email: null },
};

const input = {
  companyAccountId: 'company-a',
  command: 'İlk fotoğraftan sonra fiyat bir anda gelsin, sonra diğer resimler ve Instagram kapanışı olsun.',
  portfolio,
  photoCount: 3,
  showPrice: true,
  showLocation: true,
};

describe('createCreativeScenePlan', () => {
  it('AI tarafından döndürülen doğrulanmış sahne planını kullanır', async () => {
    const caller = vi.fn().mockResolvedValue({
      provider: 'GROQ',
      model: 'test-model',
      content: JSON.stringify({
        summary: 'Fiyat sürprizi ve Instagram kapanışı',
        scenes: [
          {
            type: 'HOOK', durationSeconds: 3, photoIndices: [0], layout: 'FULL_BLEED', transition: 'FADE', photoMotion: 'ZOOM', headline: 'Yeni portföy', body: null,
            overlays: [{ type: 'TITLE', text: null, animation: 'FADE', position: 'BOTTOM', revealAtFrame: 3 }],
          },
          {
            type: 'DETAILS', durationSeconds: 4, photoIndices: [0], layout: 'FULL_BLEED', transition: 'CUT', photoMotion: 'STILL', headline: 'Fiyat', body: null,
            overlays: [{ type: 'PRICE', text: null, animation: 'POP', position: 'CENTER', revealAtFrame: 20 }],
          },
          {
            type: 'CONTACT', durationSeconds: 8, photoIndices: [1, 2], layout: 'CONTACT_CARD', transition: 'SLIDE', photoMotion: 'PAN', headline: 'Bizi takip edin', body: null,
            overlays: [{ type: 'INSTAGRAM', text: null, animation: 'SLIDE_UP', position: 'CENTER', revealAtFrame: 10 }],
          },
        ],
      }),
    });

    const result = await createCreativeScenePlan(input, caller);

    expect(result.usedFallback).toBe(false);
    expect(result.source).toBe('GROQ');
    expect(result.plan.summary).toBe('Fiyat sürprizi ve Instagram kapanışı');
    expect(caller).toHaveBeenCalledWith('company-a', expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: expect.stringContaining(input.command) }),
    ]));
  });

  it('AI boş veya geçersiz yanıt verirse talimata özel yerel planı kullanır', async () => {
    const result = await createCreativeScenePlan(input, async () => ({
      provider: 'RULE_ENGINE',
      model: null,
      content: 'geçersiz yanıt',
    }));

    expect(result.usedFallback).toBe(true);
    expect(result.source).toBe('RULE_ENGINE');
    expect(result.plan.scenes[1]?.overlays).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'PRICE', animation: 'POP' })])
    );
    expect(result.plan.scenes.at(-1)?.overlays).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'INSTAGRAM' })])
    );
  });

  it('Cloudflare tarafından kullanılan güvenli sahne eş anlamlılarını normalize eder', async () => {
    const caller = vi.fn().mockResolvedValue({
      provider: 'CLOUDFLARE',
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
      content: JSON.stringify({
        summary: 'Fiyat, galeri ve Instagram kapanışı',
        scenes: [
          {
            type: 'HOOK', durationSeconds: 2, photoIndices: [0], layout: 'FULL_BLEED', transition: 'FADE', photoMotion: 'ZOOM', headline: '6.500.000 TL', body: null,
            overlays: [{ type: 'PRICE', text: null, animation: 'POP', position: 'CENTER', revealAtFrame: 18 }],
          },
          {
            type: 'GALLERY', durationSeconds: 6, photoIndices: [1, 2], layout: 'GRID', transition: 'SLIDE_LEFT', photoMotion: 'NONE', headline: 'Diğer kareler', body: null,
            overlays: [],
          },
          {
            type: 'CONTACT', durationSeconds: 4, photoIndices: [2], layout: 'CENTER', transition: 'FADE', photoMotion: 'NONE', headline: 'Instagram', body: null,
            overlays: [{ type: 'TEXT', text: '@jasminegroup', animation: 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 12 }],
          },
        ],
      }),
    });

    const result = await createCreativeScenePlan(input, caller);

    expect(result.usedFallback).toBe(false);
    expect(result.source).toBe('CLOUDFLARE');
    expect(result.plan.scenes[1]).toMatchObject({
      layout: 'FRAMED',
      transition: 'SLIDE',
      photoMotion: 'STILL',
    });
    expect(result.plan.scenes[2]).toMatchObject({
      layout: 'CONTACT_CARD',
      photoMotion: 'STILL',
    });
    expect(result.plan.scenes[2]?.overlays[0]?.type).toBe('CUSTOM');
  });
});
