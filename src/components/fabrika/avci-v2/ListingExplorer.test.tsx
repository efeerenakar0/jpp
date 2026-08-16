import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ListingExplorer from './ListingExplorer';

describe('ListingExplorer tarama sınırı özeti', () => {
  it('sonuç alanında iş ve aylık kota sınırlarını gösterir', () => {
    const markup = renderToStaticMarkup(
      <ListingExplorer
        jobId="job-konut-1"
        refreshToken={0}
        scanContext={{
          jobId: 'job-konut-1',
          label: 'Konut',
          monthlyLimit: 500,
          perRunLimit: 50,
          periodEnd: null,
          periodStart: null,
          propertyType: 'KONUT',
          remaining: 450,
          requestedResults: 50,
          used: 50,
        }}
      />
    );

    expect(markup).toContain('Seçilen tarama sınırları');
    expect(markup).toContain('Bu tarama en fazla 50 ilan getirir.');
    expect(markup).toContain('450 / 500 ilan');
    expect(markup).toContain('Bu işin sonucu');
  });
});
