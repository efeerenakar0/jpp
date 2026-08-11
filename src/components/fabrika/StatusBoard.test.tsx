import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import StatusBoard from './StatusBoard';

describe('StatusBoard', () => {
  it('satış yetkisi hazır kaydını portföye katma işlemini gösterir', () => {
    const markup = renderToStaticMarkup(
      <StatusBoard
        listings={[
          {
            id: 'listing-1',
            title: 'Örnek Portföy',
            sourceUrl: 'https://www.sahibinden.com/ilan/1',
            status: 'AUTHORIZED',
            portfolioImport: {
              id: 'import-1',
              status: 'PENDING',
              propertyId: null,
              reviewNote: null,
            },
          },
        ]}
        onPortfolioJoin={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(markup).toContain('Portföyümüze Kat');
    expect(markup).toContain('Satış Yetkisi alınmaya hazır');
    expect(markup).toContain('Portföyümüze Katıldı');
  });
});
