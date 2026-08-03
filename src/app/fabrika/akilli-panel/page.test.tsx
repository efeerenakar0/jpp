import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExecutiveFlowPage from './page';

describe('/fabrika/akilli-panel', () => {
  it('renders the full executive flow experience', () => {
    const html = renderToStaticMarkup(<ExecutiveFlowPage />);
    expect(html).toContain('Portföy üretim merkezi');
    expect(html).toContain('GENEL MÜDÜR YARDIMCISI');
    expect(html).toContain('Tasarım');
  });
});
