import { describe, expect, it } from 'vitest';
import { AdPlatform } from '@prisma/client';
import {
  DEFAULT_MARKETING_CHANNELS,
  MARKETING_CHANNELS,
  normalizeMarketingChannels,
} from './marketing-channels';

describe('marketing channel catalog', () => {
  it('contains unique channel identifiers', () => {
    const ids = MARKETING_CHANNELS.map((channel) => channel.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filters unknown and duplicate channel values', () => {
    expect(
      normalizeMarketingChannels([
        AdPlatform.INSTAGRAM,
        'UNKNOWN',
        AdPlatform.INSTAGRAM,
        AdPlatform.EMAIL,
      ])
    ).toEqual([AdPlatform.INSTAGRAM, AdPlatform.EMAIL]);
  });

  it('returns safe defaults for an empty selection', () => {
    expect(normalizeMarketingChannels([])).toEqual(DEFAULT_MARKETING_CHANNELS);
  });
});
