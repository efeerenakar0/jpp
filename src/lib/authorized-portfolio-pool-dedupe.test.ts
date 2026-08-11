import { describe, expect, it } from 'vitest';

import {
  authorizedPoolDuplicateKey,
  deduplicateAuthorizedPool,
  type PoolDedupeCandidate,
} from './authorized-portfolio-pool-dedupe';

function candidate(patch: Partial<PoolDedupeCandidate> = {}): PoolDedupeCandidate {
  return {
    id: 'share-a',
    ownerCompanyAccountId: 'company-a',
    sourceListingId: null,
    title: 'Deniz Manzaralı 3+1 Daire',
    location: 'Alanya / Oba',
    price: 5_850_000,
    roomCount: '3+1',
    area: 145,
    propertyType: 'Daire',
    isOwn: false,
    hasRequesterHistory: false,
    ...patch,
  };
}

describe('authorized portfolio pool deduplication', () => {
  it('combines the same source listing across companies', () => {
    const result = deduplicateAuthorizedPool([
      candidate({ sourceListingId: 'listing-42' }),
      candidate({
        id: 'share-b',
        ownerCompanyAccountId: 'company-b',
        sourceListingId: 'LISTING-42',
        title: 'Farklı yazılmış ilan başlığı',
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ duplicateCount: 1, authorizedOfficeCount: 2 });
  });

  it('uses a conservative exact fingerprint when no source id exists', () => {
    expect(
      authorizedPoolDuplicateKey(candidate({ title: 'Deniz Manzaralı 3+1 Daire' }))
    ).toBe(
      authorizedPoolDuplicateKey(candidate({ title: 'deniz-manzaralı 3+1 daire' }))
    );

    const result = deduplicateAuthorizedPool([
      candidate(),
      candidate({ id: 'share-b', ownerCompanyAccountId: 'company-b', area: 146 }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('keeps a prior requester interaction as the visible representative', () => {
    const result = deduplicateAuthorizedPool([
      candidate({ id: 'own', isOwn: true }),
      candidate({
        id: 'requested',
        ownerCompanyAccountId: 'company-b',
        hasRequesterHistory: true,
      }),
    ]);

    expect(result[0].representative.id).toBe('requested');
  });
});
