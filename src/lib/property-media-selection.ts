export type PropertyMediaCandidate = {
  id: string;
  parentMediaId: string | null;
  isCover: boolean;
  sortOrder: number;
  mediaType: 'PHOTO' | 'POSTER' | 'MARKETING_ASSET';
  variantType: 'ORIGINAL' | 'ENHANCED' | 'CREATIVE';
  usageRightsStatus: 'CONFIRMED' | 'UNVERIFIED' | 'RESTRICTED';
  archivedAt: string | null;
  createdAt: string;
};

function createdAtValue(item: PropertyMediaCandidate) {
  const value = Date.parse(item.createdAt);
  return Number.isFinite(value) ? value : 0;
}

export function recommendPropertyMedia(
  items: PropertyMediaCandidate[],
  options: { mode: 'faithful' | 'creative'; limit?: number }
) {
  const limit = Math.max(1, Math.min(6, options.limit ?? 6));
  const available = items.filter((item) => {
    if (item.archivedAt || item.usageRightsStatus !== 'CONFIRMED') return false;
    if (item.mediaType !== 'PHOTO') return false;
    return options.mode === 'creative' || item.variantType !== 'CREATIVE';
  });
  const byParent = new Map<string, PropertyMediaCandidate[]>();

  for (const item of available) {
    const rootId = item.parentMediaId ?? item.id;
    const group = byParent.get(rootId) ?? [];
    group.push(item);
    byParent.set(rootId, group);
  }

  return [...byParent.values()]
    .map((group) => {
      const enhanced = group
        .filter((item) => item.variantType === 'ENHANCED')
        .sort((a, b) => createdAtValue(b) - createdAtValue(a))[0];
      const original = group
        .filter((item) => item.variantType === 'ORIGINAL')
        .sort((a, b) => createdAtValue(b) - createdAtValue(a))[0];
      return enhanced ?? original ?? group[0];
    })
    .sort((a, b) => {
      const aGroupCover = byParent
        .get(a.parentMediaId ?? a.id)
        ?.some((item) => item.isCover);
      const bGroupCover = byParent
        .get(b.parentMediaId ?? b.id)
        ?.some((item) => item.isCover);
      if (aGroupCover !== bGroupCover) return aGroupCover ? -1 : 1;
      return a.sortOrder - b.sortOrder || createdAtValue(b) - createdAtValue(a);
    })
    .slice(0, limit)
    .map((item) => item.id);
}

export function togglePosterMediaSelection(
  selectedIds: string[],
  mediaId: string,
  limit = 6
) {
  if (selectedIds.includes(mediaId)) {
    return selectedIds.filter((id) => id !== mediaId);
  }
  if (selectedIds.length >= limit) return selectedIds;
  return [...selectedIds, mediaId];
}
