import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { discoverOpenDirectoryPartners } from './open-directory';

describe('open partner directory discovery', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ranks complete records first and keeps public evidence URLs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            {
              id: 1,
              type: 'node',
              tags: { name: 'Eksik Emlak' },
            },
            {
              id: 2,
              type: 'way',
              tags: {
                name: 'Kaynaklı Emlak',
                website: 'https://example.com',
                email: 'hello@example.com',
                phone: '+90 555 000 00 00',
                brand: 'Kaynaklı',
                'addr:city': 'İstanbul',
                office: 'estate_agent',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await discoverOpenDirectoryPartners('RU', 30);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      displayName: 'Kaynaklı Emlak',
      countryCode: 'RU',
      corporateEmail: 'hello@example.com',
      sourceUrl: 'https://www.openstreetmap.org/way/2',
    });
  });

  it('does not accept unsupported country input', async () => {
    await expect(discoverOpenDirectoryPartners('ZZ')).rejects.toThrow(
      /desteklenmiyor/i,
    );
  });
});
