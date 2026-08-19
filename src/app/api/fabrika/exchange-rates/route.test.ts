import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requirePrincipal: vi.fn() }));

vi.mock('@/lib/fabrika-session', async () => {
  const actual = await vi.importActual<typeof import('@/lib/fabrika-session')>(
    '@/lib/fabrika-session'
  );
  return { ...actual, requireFabrikaPrincipal: mocks.requirePrincipal };
});

import { parseTcmbRates } from '@/lib/tcmb-exchange-rates';
import { GET } from './route';

const xml = `<?xml version="1.0"?><Tarih_Date Tarih="18.08.2026">
  <Currency CurrencyCode="USD"><Unit>1</Unit><ForexBuying>47.8200</ForexBuying><ForexSelling>47.9155</ForexSelling></Currency>
  <Currency CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>55.1000</ForexBuying><ForexSelling>55.2100</ForexSelling></Currency>
  <Currency CurrencyCode="GBP"><Unit>1</Unit><ForexBuying>63.8000</ForexBuying><ForexSelling>64.0000</ForexSelling></Currency>
</Tarih_Date>`;

describe('TCMB exchange-rate route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.requirePrincipal.mockResolvedValue({ account: { id: 'account-1' } });
  });

  it('normalizes official rates to one currency unit', () => {
    const parsed = parseTcmbRates(xml);
    expect(parsed.publishedDate).toBe('18.08.2026');
    expect(parsed.rates.find((rate) => rate.code === 'USD')?.selling).toBe(47.9155);
  });

  it('returns authenticated TCMB rates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml, { status: 200 })));
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.source).toBe('TCMB');
    expect(payload.rates).toHaveLength(3);
  });
});
