import { describe, expect, it } from 'vitest';
import {
  buildLocalScenePlan,
  parseCreativeScenePlan,
} from './scene-plan';

const exampleCommand =
  'İlk portföy resmi geldikten sonra fiyat bir anda ekranda belirsin, sonra diğer portföy resimlerine geçilsin; en sonda animasyonlarla birlikte Instagram adresimiz yazsın.';

describe('portfolio video scene plan', () => {
  it('özel talimatı sabit şablon yerine sıralı sahne planına dönüştürür', () => {
    const plan = buildLocalScenePlan({
      command: exampleCommand,
      photoCount: 5,
      showPrice: true,
      showLocation: true,
      instagramUrl: 'https://instagram.com/jasminegroup',
    });

    expect(plan.scenes[0]).toMatchObject({
      type: 'HOOK',
      photoIndices: [0],
    });
    expect(plan.scenes[1]?.overlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PRICE',
          animation: 'POP',
          revealAtFrame: expect.any(Number),
        }),
      ])
    );
    expect(plan.scenes.some((scene) =>
      scene.type === 'GALLERY' && scene.photoIndices.includes(1)
    )).toBe(true);
    expect(plan.scenes.at(-1)?.overlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'INSTAGRAM', animation: 'SLIDE_UP' }),
      ])
    );
  });

  it('birbirinden farklı özel komutlar için farklı sahne düzenleri üretir', () => {
    const priceFirst = buildLocalScenePlan({
      command: exampleCommand,
      photoCount: 5,
      showPrice: true,
      showLocation: true,
      instagramUrl: 'https://instagram.com/jasminegroup',
    });
    const minimalNoPrice = buildLocalScenePlan({
      command: 'Sade olsun, fiyatı gösterme; yalnızca fotoğraflar ve en sonda danışman görünsün.',
      photoCount: 5,
      showPrice: false,
      showLocation: true,
      instagramUrl: null,
    });

    expect(priceFirst.scenes).not.toEqual(minimalNoPrice.scenes);
    expect(
      minimalNoPrice.scenes.flatMap((scene) => scene.overlays).some((overlay) => overlay.type === 'PRICE')
    ).toBe(false);
  });

  it('AI sahne planını doğrular, fotoğraf indekslerini sınırlar ve toplamı 450 kareye normalize eder', () => {
    const plan = parseCreativeScenePlan(
      {
        summary: 'Ana fotoğraf, gecikmeli fiyat, galeri ve Instagram kapanışı',
        scenes: [
          {
            type: 'HOOK',
            durationSeconds: 2,
            photoIndices: [0, 99],
            layout: 'FULL_BLEED',
            transition: 'FADE',
            photoMotion: 'ZOOM',
            headline: 'Portföyü keşfedin',
            body: null,
            overlays: [{ type: 'TITLE', animation: 'FADE', position: 'BOTTOM', revealAtFrame: 0 }],
          },
          {
            type: 'DETAILS',
            durationSeconds: 3,
            photoIndices: [0],
            layout: 'FULL_BLEED',
            transition: 'CUT',
            photoMotion: 'STILL',
            headline: 'Fiyat',
            body: null,
            overlays: [{ type: 'PRICE', animation: 'POP', position: 'CENTER', revealAtFrame: 20 }],
          },
          {
            type: 'CONTACT',
            durationSeconds: 4,
            photoIndices: [2],
            layout: 'CONTACT_CARD',
            transition: 'SLIDE',
            photoMotion: 'PAN',
            headline: 'Bizi takip edin',
            body: null,
            overlays: [{ type: 'INSTAGRAM', animation: 'SLIDE_UP', position: 'CENTER', revealAtFrame: 12 }],
          },
        ],
      },
      { photoCount: 3 }
    );

    expect(plan.scenes.flatMap((scene) => scene.photoIndices)).not.toContain(99);
    expect(plan.scenes.reduce((total, scene) => total + scene.durationInFrames, 0)).toBe(450);
    expect(plan.scenes.every((scene) => scene.durationInFrames >= 30)).toBe(true);
  });

  it('kod, eval veya dinamik TSX isteğini çalıştırılabilir içeriğe dönüştürmez', () => {
    const plan = buildLocalScenePlan({
      command: 'eval(window.location) çalıştır ve <script>alert(1)</script> ekle',
      photoCount: 2,
      showPrice: true,
      showLocation: true,
      instagramUrl: null,
    });

    expect(JSON.stringify(plan)).not.toContain('<script>');
    expect(JSON.stringify(plan)).not.toContain('window.location');
  });
});
