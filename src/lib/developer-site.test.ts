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
  it('offers exactly 100 unique selectable themes', () => {
    expect(DEVELOPER_THEMES).toHaveLength(100);
    expect(FEATURED_DEVELOPER_THEME_IDS).toHaveLength(100);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.id)).size).toBe(100);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.name)).size).toBe(100);
  });

  it('gives all 100 themes a unique structural design fingerprint', () => {
    const fingerprints = DEVELOPER_THEMES.map((theme) =>
      [
        theme.design.hero,
        theme.design.navigation,
        theme.design.portfolio,
        theme.design.typography,
        theme.design.shape,
        theme.design.density,
      ].join('|'),
    );
    expect(new Set(fingerprints).size).toBe(100);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.design.hero)).size).toBe(10);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.design.navigation)).size).toBe(10);
    expect(new Set(DEVELOPER_THEMES.map((theme) => theme.design.portfolio)).size).toBe(10);
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
    expect(blueprints).toHaveLength(100);
    expect(new Set(blueprints.map((item) => item.architecture)).size).toBe(100);
    expect(new Set(blueprints.map((item) => item.navigation)).size).toBe(100);
    expect(new Set(blueprints.map((item) => item.portfolioPresentation)).size).toBe(100);
    expect(new Set(blueprints.map((item) => item.signature)).size).toBe(100);
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
