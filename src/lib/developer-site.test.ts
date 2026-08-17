import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPER_THEME_ID,
  DEVELOPER_THEME_BLUEPRINTS,
  DEVELOPER_THEMES,
  FEATURED_DEVELOPER_THEME_IDS,
  defaultDeveloperSiteContent,
  getDeveloperTheme,
  parseDeveloperSiteContent,
} from './developer-site';

describe('developer website themes and content', () => {
  it('offers exactly 25 unique selectable themes', () => {
    expect(DEVELOPER_THEMES).toHaveLength(25);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.id)).size).toBe(25);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.name)).size).toBe(25);
  });

  it('falls back to the safe default theme for an unknown id', () => {
    expect(getDeveloperTheme('unknown-theme').id).toBe(
      DEFAULT_DEVELOPER_THEME_ID,
    );
  });

  it('gives every featured website a unique architecture and portfolio presentation', () => {
    const blueprints = FEATURED_DEVELOPER_THEME_IDS.map(
      (id) => DEVELOPER_THEME_BLUEPRINTS[id],
    );
    expect(blueprints).toHaveLength(15);
    expect(new Set(blueprints.map((item) => item.architecture)).size).toBe(15);
    expect(new Set(blueprints.map((item) => item.navigation)).size).toBe(15);
    expect(new Set(blueprints.map((item) => item.portfolioPresentation)).size).toBe(15);
    expect(new Set(blueprints.map((item) => item.signature)).size).toBe(15);
  });

  it('creates complete editable website content for a company', () => {
    const content = defaultDeveloperSiteContent('Jasmine Gayrimenkul');
    expect(content.about.title).toContain('Jasmine Gayrimenkul');
    expect(content.services.items).toHaveLength(3);
    expect(content.blog.posts).toHaveLength(3);
    expect(content.faq.items[0]?.answer).toContain('Portföy Uzmanı');
  });

  it('replaces malformed stored content with complete defaults', () => {
    const content = parseDeveloperSiteContent({ hero: {} }, 'Örnek Emlak');
    expect(content.hero.title.length).toBeGreaterThan(10);
    expect(content.contact.title).toBeTruthy();
  });
});
