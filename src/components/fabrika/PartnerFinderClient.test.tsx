import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import PartnerFinderClient from './PartnerFinderClient';

describe('PartnerFinderClient workflow design', () => {
  it('renders the country-aware four-stage partner workspace inside the existing shell', () => {
    const html = renderToStaticMarkup(
      <PartnerFinderClient
        initialPartners={[
          {
            id: 'partner-1',
            displayName: 'North Estate',
            legalName: 'North Estate LLC',
            countryCode: 'RU',
            countryName: 'Rusya Federasyonu',
            city: 'Moskova',
            websiteUrl: 'https://example.com',
            logoUrl: 'https://example.com/logo.png',
            about: 'Uluslararası konut yatırımlarında uzman emlak ofisi.',
            address: 'Moskova',
            languages: ['ru', 'en'],
            specialties: ['Lüks konut'],
            fitScore: 92,
            confidenceScore: 84,
            stage: 'DISCOVERED',
            lastVerifiedAt: '2026-08-01T00:00:00.000Z',
            contacts: [{ emailMasked: 'i***@example.com', verificationStatus: 'SOURCE_VERIFIED', active: true }],
            sources: [],
          },
        ]}
        owner
      />,
    );

    expect(html).toContain('Keşiften anlaşmaya, tek akış.');
    expect(html).toContain('Pazar Seç');
    expect(html).toContain('Yeni Bulunanlar');
    expect(html).toContain('İnceleniyor');
    expect(html).toContain('İletişimde');
    expect(html).toContain('Aktif Partner');
    expect(html).toContain('North Estate logosu');
    expect(html).toContain('Uluslararası konut yatırımlarında uzman emlak ofisi.');
    expect(html).toContain('© OpenStreetMap katkıda bulunanları');
  });
});
