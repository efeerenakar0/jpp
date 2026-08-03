import { describe, expect, it } from 'vitest';

import { resolvePropertyCandidates } from './property-resolution';

const properties = [
  {
    id: 'p-104',
    referenceCode: 'P-104',
    title: 'Kadıköy Moda 3+1 Deniz Manzaralı Daire',
    location: 'İstanbul / Kadıköy / Moda',
  },
  {
    id: 'p-205',
    referenceCode: 'P-205',
    title: 'Kadıköy Fenerbahçe 2+1 Daire',
    location: 'İstanbul / Kadıköy / Fenerbahçe',
  },
];

describe('viewing property resolution', () => {
  it('resolves an explicit reference code deterministically', () => {
    expect(
      resolvePropertyCandidates('P-104 için yarın gösterim istiyorum', properties)
    ).toMatchObject({ status: 'RESOLVED', propertyId: 'p-104' });
  });

  it('does not guess when multiple properties match a broad location', () => {
    const result = resolvePropertyCandidates(
      'Kadıköydeki evi görmek istiyorum',
      properties
    );
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.candidates).toHaveLength(2);
  });

  it('returns not found instead of creating a null-property task', () => {
    expect(
      resolvePropertyCandidates('Antalya Kestel villayı görmek istiyorum', properties)
        .status
    ).toBe('NOT_FOUND');
  });
});
