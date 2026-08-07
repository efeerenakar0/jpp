import { describe, expect, it } from 'vitest';
import {
  buildCreativeAssetPromptContext,
  creativeAssetBelongsToProperty,
  type MarketingCreativeAsset,
} from './marketing-creative-assets';

const poster: MarketingCreativeAsset = {
  id: 'poster-1',
  kind: 'POSTER',
  propertyId: 'property-a',
  title: 'Sahil evi posteri',
  detail: 'Zarif ve doğal emlak posteri',
  previewUrl: 'https://cdn.example.test/poster.png',
  downloadUrl: 'https://cdn.example.test/poster.png',
  ratio: '4:5',
  durationSeconds: null,
  createdAt: '2026-08-05T10:00:00.000Z',
  property: {
    id: 'property-a',
    title: 'Sahil evi',
    referenceCode: 'P-104',
  },
};

describe('marketing creative assets', () => {
  it('prevents using an asset from another property', () => {
    expect(creativeAssetBelongsToProperty(poster, 'property-a')).toBe(true);
    expect(creativeAssetBelongsToProperty(poster, 'property-b')).toBe(false);
  });

  it('builds bounded semantic context without exposing URLs', () => {
    const context = buildCreativeAssetPromptContext({
      ...poster,
      detail: `Kreatif brief ${'x'.repeat(4_000)}`,
    });

    expect(context).toContain('POSTER');
    expect(context).toContain('Sahil evi posteri');
    expect(context.length).toBeLessThan(2_000);
    expect(context).not.toContain('cdn.example.test');
  });
});
