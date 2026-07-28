import { describe, expect, it } from 'vitest';
import {
  buildAssistantPropertyContext,
  rankAssistantProperties,
  type AssistantProperty,
} from './assistant-property-context';

const now = new Date('2026-07-28T00:00:00.000Z');
const properties: AssistantProperty[] = [
  {
    title: 'Kestel deniz manzaralı daire',
    referenceCode: 'KST-01',
    location: 'Antalya / Alanya / Kestel',
    price: 6_500_000,
    roomCount: '3+1',
    area: 150,
    description: 'Denize yakın',
    updatedAt: now,
  },
  {
    title: 'Mahmutlar merkez daire',
    referenceCode: 'MHM-01',
    location: 'Antalya / Alanya / Mahmutlar',
    price: 4_250_000,
    roomCount: '2+1',
    area: 110,
    description: 'Merkezi konum',
    updatedAt: now,
  },
];

describe('assistant property context', () => {
  it('ranks a Turkish location with a suffix as the first match', () => {
    const ranked = rankAssistantProperties(
      properties,
      'Mahmutlarda satılık bir ev lazım'
    );

    expect(ranked[0]?.property.referenceCode).toBe('MHM-01');
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  it('includes the current active portfolio count and listing details', () => {
    const parsed = JSON.parse(
      buildAssistantPropertyContext(properties, 'Alanya 3+1 daire')
    );

    expect(parsed.totalActiveListings).toBe(2);
    expect(parsed.listings).toHaveLength(2);
    expect(parsed.listings[0]).toMatchObject({
      location: 'Antalya / Alanya / Kestel',
      roomCount: '3+1',
    });
  });
});
