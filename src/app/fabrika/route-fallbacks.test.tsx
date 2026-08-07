import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import FabrikaError from './error';
import FabrikaLoading from './loading';

describe('Fabrika route fallbacks', () => {
  it('announces a lightweight route loading state', () => {
    const html = renderToStaticMarkup(<FabrikaLoading />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Çalışma alanınız hazırlanıyor');
  });

  it('offers an accessible retry without exposing the error message', () => {
    const error = Object.assign(new Error('SECRET_INTERNAL_DETAIL'), {
      digest: 'safe-digest',
    });
    const html = renderToStaticMarkup(
      <FabrikaError error={error} unstable_retry={vi.fn()} />
    );

    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Yeniden dene');
    expect(html).not.toContain('SECRET_INTERNAL_DETAIL');
    expect(html).not.toContain('safe-digest');
  });
});
