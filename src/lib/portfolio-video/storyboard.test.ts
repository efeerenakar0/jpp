import { describe, expect, it } from 'vitest';
import { LocalRuleCreativeDirector } from './creative-director';
import { buildPortfolioStoryboard } from './storyboard';
import type { PortfolioVideoPortfolio } from './types';

const portfolio: PortfolioVideoPortfolio = {
  id: 'property-a',
  title: 'Kestel Deniz Manzaralı Aile Dairesi',
  referenceCode: 'P-104',
  location: 'Alanya / Kestel',
  price: 6_500_000,
  roomCount: '3+1',
  area: 165,
  description: 'Geniş balkon, açık havuz ve deniz manzarası.',
  features: ['Geniş balkon', 'Açık havuz', 'Deniz manzarası'],
  status: 'ACTIVE',
  photos: [
    { id: 'cover', url: 'https://cdn.test/cover.jpg', fileName: 'cover.jpg', isCover: true },
    { id: 'salon', url: 'https://cdn.test/salon.jpg', fileName: 'salon.jpg', isCover: false },
    { id: 'view', url: 'https://cdn.test/view.jpg', fileName: 'view.jpg', isCover: false },
  ],
  company: {
    name: 'Jasmine Group',
    logoUrl: null,
  },
  advisor: {
    name: 'Efe Eren',
    phone: '+90 555 111 22 33',
    email: 'efe@example.com',
  },
};

describe('buildPortfolioStoryboard', () => {
  it('1080x1920, 30 FPS ve 450 karelik beş sahne üretir', () => {
    const direction = new LocalRuleCreativeDirector().direct({
      command: 'dikkat çekici yap',
    });
    const result = buildPortfolioStoryboard({ portfolio, direction });

    expect(result).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 450,
    });
    expect(result.scenes.map((scene) => scene.type)).toEqual([
      'HOOK',
      'GALLERY',
      'FEATURES',
      'DETAILS',
      'CONTACT',
    ]);
    expect(result.scenes.at(-1)?.toFrame).toBe(450);
  });

  it('kullanıcının fotoğraf sırasını korur ve seçilmeyenleri kullanmaz', () => {
    const direction = new LocalRuleCreativeDirector().direct({ command: '' });
    const result = buildPortfolioStoryboard({
      portfolio,
      direction,
      selectedPhotoIds: ['view', 'cover'],
    });

    expect(result.photoUrls).toEqual([
      'https://cdn.test/view.jpg',
      'https://cdn.test/cover.jpg',
    ]);
  });

  it('fiyat gizliyken storyboard metinlerine fiyatı koymaz', () => {
    const direction = new LocalRuleCreativeDirector().direct({
      command: 'lüks olsun, fiyatı gösterme',
    });
    const result = buildPortfolioStoryboard({ portfolio, direction });

    expect(result.showPrice).toBe(false);
    expect(JSON.stringify(result.scenes)).not.toContain('6.500.000');
  });

  it('eksik veri ve uzun metinlerde güvenli kısa yedekler kullanır', () => {
    const direction = new LocalRuleCreativeDirector().direct({ command: '' });
    const result = buildPortfolioStoryboard({
      portfolio: {
        ...portfolio,
        title: 'A'.repeat(300),
        location: null,
        price: null,
        roomCount: null,
        area: null,
        photos: [],
        features: [],
      },
      direction,
    });

    expect(result.title.length).toBeLessThanOrEqual(72);
    expect(result.locationLabel).toBe('Konum bilgisi için iletişime geçin');
    expect(result.photoUrls).toEqual([]);
  });
});
