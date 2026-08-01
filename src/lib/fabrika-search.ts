export function normalizeFabrikaSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizeSearchPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-15) : '';
}

export function safeSearchLimit(value: string | null, fallback = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}
