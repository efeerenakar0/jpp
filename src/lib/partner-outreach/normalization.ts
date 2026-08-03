import type { PartnerCandidateInput } from './types';

export function normalizeDomain(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return null;
  }
}

export function normalizePartnerEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function compact(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, '') || '';
}

function candidateKey(candidate: PartnerCandidateInput) {
  const domain = normalizeDomain(candidate.domain);
  if (domain) return `domain:${domain}`;
  if (candidate.registrationNumber?.trim()) {
    return `registration:${compact(candidate.registrationNumber)}`;
  }
  if (candidate.licenseNumber?.trim()) {
    return `license:${compact(candidate.licenseNumber)}`;
  }
  if (candidate.externalId?.trim()) return `external:${candidate.externalId.trim()}`;
  return `name-city:${compact(candidate.name)}:${compact(candidate.city)}`;
}

export function dedupePartnerCandidates<T extends PartnerCandidateInput>(
  candidates: T[]
): T[] {
  const grouped = new Map<string, T>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...candidate,
        domain: normalizeDomain(candidate.domain),
        sourceIds: [...new Set(candidate.sourceIds)].sort(),
      });
      continue;
    }
    const preferred =
      candidate.completeness > existing.completeness ? candidate : existing;
    grouped.set(key, {
      ...preferred,
      domain: normalizeDomain(preferred.domain),
      sourceIds: [...new Set([...existing.sourceIds, ...candidate.sourceIds])].sort(),
    });
  }
  return [...grouped.values()];
}
