import { describe, expect, it } from 'vitest';

import {
  PARTNER_COUNTRIES,
  TURKEY_PROPERTY_BUYER_MARKETS,
  partnerCountry,
} from './countries';

describe('partner country catalog', () => {
  it('contains exactly the 25 Turkey-focused foreign buyer markets', () => {
    expect(PARTNER_COUNTRIES).toHaveLength(25);
    expect(TURKEY_PROPERTY_BUYER_MARKETS.map((market) => market.priority)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
    expect(new Set(PARTNER_COUNTRIES.map(([code]) => code)).size).toBe(25);
    expect(partnerCountry('ru')).toMatchObject({
      code: 'RU',
      name: 'Rusya Federasyonu',
      language: 'ru',
      priority: 1,
    });
    expect(partnerCountry('IR')).toMatchObject({ code: 'IR', language: 'fa' });
    expect(partnerCountry('UA')).toMatchObject({ code: 'UA', language: 'uk' });
  });

  it('rejects countries outside the focused market catalog', () => {
    expect(partnerCountry('TR')).toBeNull();
    expect(partnerCountry('ZZ')).toBeNull();
  });
});
