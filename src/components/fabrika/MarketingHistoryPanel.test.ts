import { describe, expect, it } from 'vitest';
import {
  createMarketingHistoryItems,
  filterMarketingHistoryItems,
} from './MarketingHistoryPanel';

describe('MarketingHistoryPanel helpers', () => {
  const items = createMarketingHistoryItems({
    campaigns: [
      {
        id: 'campaign-domestic',
        name: 'Alanya Instagram kampanyası',
        type: 'listing',
        createdAt: '2026-08-10T10:00:00.000Z',
        property: {
          id: 'property-1',
          title: 'Deniz manzaralı daire',
          location: 'Alanya',
          referenceCode: 'JG-101',
        },
      },
      {
        id: 'campaign-international',
        name: 'Almanya tanıtım planı',
        type: 'international',
        createdAt: '2026-08-12T10:00:00.000Z',
        internationalPlan: {
          countryCode: 'DE',
          countryName: 'Almanya',
          language: 'Almanca',
          portalCopies: [],
        },
      },
    ],
    creativeAssets: [
      {
        id: 'poster-1',
        kind: 'POSTER',
        propertyId: 'property-1',
        title: 'Instagram posteri',
        previewUrl: '/preview',
        downloadUrl: '/download',
        createdAt: '2026-08-11T10:00:00.000Z',
        property: { id: 'property-1', title: 'Deniz manzaralı daire' },
      },
    ],
    websiteAnalyses: [],
  });

  it('combines all work in reverse chronological order', () => {
    expect(items.map((item) => item.key)).toEqual([
      'campaign:campaign-international',
      'asset:POSTER:poster-1',
      'campaign:campaign-domestic',
    ]);
  });

  it('filters by type and Turkish search text', () => {
    expect(filterMarketingHistoryItems(items, 'poster', '')).toHaveLength(1);
    expect(filterMarketingHistoryItems(items, 'all', 'almanya')).toHaveLength(1);
    expect(filterMarketingHistoryItems(items, 'domestic', 'alanya')).toHaveLength(1);
  });
});
