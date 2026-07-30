import { describe, expect, it } from 'vitest';
import {
  recommendPropertyMedia,
  togglePosterMediaSelection,
  type PropertyMediaCandidate,
} from './property-media-selection';

const media = (
  input: Partial<PropertyMediaCandidate> & Pick<PropertyMediaCandidate, 'id'>
): PropertyMediaCandidate => ({
  id: input.id,
  parentMediaId: input.parentMediaId ?? null,
  isCover: input.isCover ?? false,
  sortOrder: input.sortOrder ?? 0,
  mediaType: input.mediaType ?? 'PHOTO',
  variantType: input.variantType ?? 'ORIGINAL',
  usageRightsStatus: input.usageRightsStatus ?? 'CONFIRMED',
  archivedAt: input.archivedAt ?? null,
  createdAt: input.createdAt ?? '2026-07-30T00:00:00.000Z',
});

describe('recommendPropertyMedia', () => {
  it('kapak görselini ilk sıraya alır ve en fazla altı görsel önerir', () => {
    const items = Array.from({ length: 9 }, (_, index) =>
      media({ id: `media-${index}`, isCover: index === 7, sortOrder: index })
    );

    expect(recommendPropertyMedia(items, { mode: 'faithful' })).toEqual([
      'media-7',
      'media-0',
      'media-1',
      'media-2',
      'media-3',
      'media-4',
    ]);
  });

  it('güncel iyileştirilmiş varyantı orijinal yerine tercih eder', () => {
    const items = [
      media({ id: 'original', isCover: true }),
      media({
        id: 'enhanced-old',
        parentMediaId: 'original',
        variantType: 'ENHANCED',
        createdAt: '2026-07-29T00:00:00.000Z',
      }),
      media({
        id: 'enhanced-new',
        parentMediaId: 'original',
        variantType: 'ENHANCED',
        createdAt: '2026-07-30T00:00:00.000Z',
      }),
    ];

    expect(recommendPropertyMedia(items, { mode: 'faithful' })).toEqual([
      'enhanced-new',
    ]);
  });

  it('gerçek fotoğraf modunda kısıtlı, doğrulanmamış ve kreatif medyayı dışlar', () => {
    const items = [
      media({ id: 'safe' }),
      media({ id: 'unverified', usageRightsStatus: 'UNVERIFIED' }),
      media({ id: 'restricted', usageRightsStatus: 'RESTRICTED' }),
      media({ id: 'creative', variantType: 'CREATIVE' }),
      media({ id: 'poster', mediaType: 'POSTER' }),
      media({ id: 'archived', archivedAt: '2026-07-30T00:00:00.000Z' }),
    ];

    expect(recommendPropertyMedia(items, { mode: 'faithful' })).toEqual([
      'safe',
    ]);
  });
});

describe('togglePosterMediaSelection', () => {
  it('seçimi kaldırır ve altı görsel sınırını korur', () => {
    expect(togglePosterMediaSelection(['a', 'b'], 'a')).toEqual(['b']);
    expect(
      togglePosterMediaSelection(['a', 'b', 'c', 'd', 'e', 'f'], 'g')
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('yeni seçimi listenin sonuna ekler', () => {
    expect(togglePosterMediaSelection(['a'], 'b')).toEqual(['a', 'b']);
  });
});
