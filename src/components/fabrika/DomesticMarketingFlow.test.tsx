import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DomesticMarketingFlow from './DomesticMarketingFlow';

describe('DomesticMarketingFlow', () => {
  it('starts with a simple three-step portfolio-or-brand choice', () => {
    const html = renderToStaticMarkup(
      <DomesticMarketingFlow
        companyName="Jasmine Group"
        properties={[
          {
            id: 'property-1',
            title: 'Deniz manzaralı daire',
            location: 'Alanya',
            price: 8_500_000,
            imageUrl: null,
            referenceCode: 'JG-101',
            status: 'ACTIVE',
          },
        ]}
        campaigns={[]}
        creativeAssets={[]}
        onRefresh={async () => undefined}
      />,
    );

    expect(html).toContain('Seç');
    expect(html).toContain('Hazırla');
    expect(html).toContain('Kontrol et');
    expect(html).toContain('Portföy tanıtımı');
    expect(html).toContain('Şirket tanıtımı');
    expect(html).toContain('Web sitesi reklam planı');
    expect(html).toContain('Deniz manzaralı daire');
    expect(html).not.toContain('&quot;caption&quot;');
  });
});
