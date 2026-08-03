import { describe, expect, it } from 'vitest';
import {
  LocalRuleCreativeDirector,
  creativeDirectionInputSchema,
} from './creative-director';
import { portfolioVideoCreativeChoiceSchema } from './types';

const director = new LocalRuleCreativeDirector();

describe('LocalRuleCreativeDirector', () => {
  it.each([
    ['Dikkat çekici ve enerjik yap', 'BOLD', 'FAST'],
    ['Lüks ve sinematik olsun', 'CINEMATIC', 'SLOW'],
    ['Ailelere hitap etsin', 'FAMILY', 'MEDIUM'],
    ['Yatırım fırsatını öne çıkar', 'INVESTMENT', 'MEDIUM'],
    ['Sade ve minimal olsun', 'MINIMAL', 'SLOW'],
  ] as const)('%s komutunu yerel stile dönüştürür', (command, style, pace) => {
    const result = director.direct({ command });

    expect(result.style).toBe(style);
    expect(result.pace).toBe(pace);
  });

  it('fiyatı gösterme komutunu diğer stilden bağımsız uygular', () => {
    const result = director.direct({
      command: 'Çok lüks ve sinematik olsun ama fiyatı gösterme',
    });

    expect(result.style).toBe('CINEMATIC');
    expect(result.showPrice).toBe(false);
  });

  it('Türkçe büyük-küçük harf ve noktalama farklarını güvenle normalleştirir', () => {
    const result = director.direct({ command: '  AİLELERE HİTAP ETSİN!  ' });

    expect(result.style).toBe('FAMILY');
    expect(result.tone).toBe('WARM');
  });

  it('bilinmeyen komutu çalıştırmaya kalkmadan dengeli varsayılana düşürür', () => {
    const result = director.direct({
      command: '(()=>{throw new Error("çalışmamalı")})()',
    });

    expect(result.style).toBe('BALANCED');
    expect(result.showPrice).toBe(true);
  });

  it('aşırı uzun girdiyi Zod ile reddeder', () => {
    expect(() =>
      creativeDirectionInputSchema.parse({ command: 'a'.repeat(1001) })
    ).toThrow();
  });

  it('arayüzün özel yaratıcı talimat seçimini doğrular', () => {
    expect(portfolioVideoCreativeChoiceSchema.parse('CUSTOM')).toBe('CUSTOM');
  });

  it('özel talimattaki animasyon, sıralama ve kapanış sözünü yapısal yönergeye dönüştürür', () => {
    const result = director.direct({
      command: 'Bu portföydeki resimler sıra sıra çıkarken güzel animasyonlar görünsün, en son kısımda da "Ev alma komşu al" yazsın',
    });

    expect(result.galleryTransition).toBe('SLIDE');
    expect(result.photoMotion).toBe('PAN');
    expect(result.closingMessage).toBe('Ev alma komşu al');
    expect(result.effectIntensity).toBeGreaterThan(0.5);
  });

  it('hazır stillere gerçekten farklı görsel hareketler verir', () => {
    const bold = director.direct({ command: 'dikkat çekici ve enerjik yap' });
    const cinematic = director.direct({ command: 'lüks ve sinematik olsun' });
    const minimal = director.direct({ command: 'sade ve minimal olsun' });

    expect([bold.galleryTransition, bold.photoMotion]).not.toEqual([
      cinematic.galleryTransition,
      cinematic.photoMotion,
    ]);
    expect([minimal.galleryTransition, minimal.photoMotion]).not.toEqual([
      bold.galleryTransition,
      bold.photoMotion,
    ]);
  });
});
