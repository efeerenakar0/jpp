import type {
  HuntingListing,
  PortfolioFilter,
  PortfolioRow,
  WorkspaceProperty,
  WorkspaceTask,
} from './types';

export type ContactPermission = 'allowed' | 'denied' | 'review' | 'missing';

export function resolveContactPermission(
  listing: Pick<HuntingListing, 'contacts'>
): ContactPermission {
  const contact = listing.contacts?.[0];
  if (!contact) return 'missing';
  if (contact.doNotContactAt) return 'denied';
  const decision = contact.policyDecisions[0];
  if (decision) return decision.allowed ? 'allowed' : 'denied';
  if (
    contact.verificationStatus !== 'VERIFIED' ||
    contact.legalBasisStatus === 'UNKNOWN' ||
    contact.legalBasisStatus === 'REJECTED'
  ) {
    return 'review';
  }
  return 'review';
}

export function buildPortfolioRows(
  listings: HuntingListing[],
  properties: WorkspaceProperty[],
  tasks: WorkspaceTask[]
): PortfolioRow[] {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const linkedPropertyIds = new Set<string>();
  const nextTaskByProperty = new Map<string, string>();

  for (const task of tasks) {
    if (task.status !== 'OPEN' || !task.dueAt || !task.property?.id) continue;
    const current = nextTaskByProperty.get(task.property.id);
    if (!current || new Date(task.dueAt).getTime() < new Date(current).getTime()) {
      nextTaskByProperty.set(task.property.id, task.dueAt);
    }
  }

  const rows = listings.map((listing): PortfolioRow => {
    const propertyId = listing.portfolioImport?.propertyId || null;
    const property = propertyId ? propertyById.get(propertyId) || null : null;
    if (property) linkedPropertyIds.add(property.id);
    return {
      key: `listing:${listing.id}`,
      title: property?.title || listing.title,
      location: property?.location || listing.location || null,
      price:
        property?.price != null
          ? new Intl.NumberFormat('tr-TR', {
              style: 'currency',
              currency: 'TRY',
              maximumFractionDigits: 0,
            }).format(property.price)
          : listing.price || null,
      imageUrl: property?.imageUrl || null,
      listing,
      property,
      stage: listing.status,
      assignedMember:
        property?.assignedMember ||
        listing.portfolioImport?.property?.assignedMember ||
        null,
      nextActionAt: property ? nextTaskByProperty.get(property.id) || null : null,
      updatedAt: listing.updatedAt || property?.updatedAt || null,
    };
  });

  for (const property of properties) {
    if (linkedPropertyIds.has(property.id)) continue;
    rows.push({
      key: `property:${property.id}`,
      title: property.title,
      location: property.location,
      price:
        property.price == null
          ? null
          : new Intl.NumberFormat('tr-TR', {
              style: 'currency',
              currency: 'TRY',
              maximumFractionDigits: 0,
            }).format(property.price),
      imageUrl: property.imageUrl,
      listing: null,
      property,
      stage: 'PORTFOLIO',
      assignedMember: property.assignedMember,
      nextActionAt: nextTaskByProperty.get(property.id) || null,
      updatedAt: property.updatedAt || null,
    });
  }

  return rows.sort((left, right) => {
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function filterPortfolioRows(
  rows: PortfolioRow[],
  filter: PortfolioFilter,
  query = ''
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  return rows.filter((row) => {
    const matchesQuery =
      !normalizedQuery ||
      [row.title, row.location, row.assignedMember?.name]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('tr-TR').includes(normalizedQuery)
        );
    if (!matchesQuery) return false;
    if (filter === 'all') return true;
    if (filter === 'negotiation') return row.stage === 'YELLOW';
    if (filter === 'authorized') return row.stage === 'AUTHORIZED';
    if (filter === 'joined') {
      return row.stage === 'GREEN' || Boolean(row.property);
    }
    if (filter === 'eliminated') return row.stage === 'RED';
    return row.property?.status === 'ACTIVE';
  });
}
