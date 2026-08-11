export type PoolDedupeCandidate = {
  id: string;
  ownerCompanyAccountId: string;
  sourceListingId: string | null;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  propertyType: string | null;
  isOwn: boolean;
  hasRequesterHistory: boolean;
};

function normalize(value: string | null) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdentifier(value: string | null) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
}

/**
 * Cross-company records are only combined when the match is deterministic.
 * This deliberately avoids fuzzy matching so two similar flats in the same
 * building are never hidden as a false duplicate.
 */
export function authorizedPoolDuplicateKey(candidate: PoolDedupeCandidate) {
  const sourceListingId = normalizeIdentifier(candidate.sourceListingId);
  if (sourceListingId) {
    return `source:${sourceListingId}|${normalize(candidate.location)}|${candidate.price ?? ''}`;
  }

  return [
    'exact',
    normalize(candidate.title),
    normalize(candidate.location),
    candidate.price ?? '',
    normalize(candidate.roomCount),
    candidate.area ?? '',
    normalize(candidate.propertyType),
  ].join('|');
}

export function deduplicateAuthorizedPool<T extends PoolDedupeCandidate>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = authorizedPoolDuplicateKey(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return [...groups.values()].map((group) => {
    const representative = [...group].sort((left, right) => {
      if (left.hasRequesterHistory !== right.hasRequesterHistory) {
        return left.hasRequesterHistory ? -1 : 1;
      }
      if (left.isOwn !== right.isOwn) return left.isOwn ? 1 : -1;
      return 0;
    })[0];

    return {
      representative,
      duplicateCount: group.length - 1,
      authorizedOfficeCount: new Set(group.map((item) => item.ownerCompanyAccountId)).size,
    };
  });
}
