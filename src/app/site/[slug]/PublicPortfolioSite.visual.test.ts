import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const sectionRouteSource = readFileSync(
  new URL('./[section]/page.tsx', import.meta.url),
  'utf8',
);

describe('published AI Yazılımcı website safeguards', () => {
  it('keeps every full website genuinely multi-page', () => {
    for (const section of [
      'hakkimizda',
      'hizmetler',
      'portfoyler',
      'blog',
      'sik-sorulanlar',
      'iletisim',
    ]) {
      expect(pageSource).toContain(`'${section}'`);
    }
    expect(pageSource).toContain('`/site/${slug}/${target}`');
    expect(sectionRouteSource).toContain('PUBLIC_SITE_SECTIONS');
    expect(sectionRouteSource).toContain('PublicPortfolioSite');
  });

  it('applies the selected structural design system to the published site', () => {
    expect(pageSource).toContain('data-hero={selectedTheme.design.hero}');
    expect(pageSource).toContain('data-navigation={selectedTheme.design.navigation}');
    expect(pageSource).toContain('data-portfolio={selectedTheme.design.portfolio}');
    expect(pageSource).toContain('data-typography={selectedTheme.design.typography}');
    expect(pageSource).toContain('data-shape={selectedTheme.design.shape}');
    expect(pageSource).toContain('data-density={selectedTheme.design.density}');
  });
});
