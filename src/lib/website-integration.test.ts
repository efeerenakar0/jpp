import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildWebsiteIntegrationPrompt,
  createWebsiteApiKeyLookup,
  generateWebsiteApiKey,
  portfolioCreateSchema,
  portfolioUpdateSchema,
  shouldIncludeWebsiteFile,
  WebsiteApiRateLimiter,
  websiteApiKeyHint,
  websiteIntegrationMetadataSchema,
} from './website-integration';

describe('website integration credentials', () => {
  const originalSecret = process.env.WEBSITE_API_KEY_SECRET;

  beforeEach(() => {
    process.env.WEBSITE_API_KEY_SECRET = 'test-only-website-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.WEBSITE_API_KEY_SECRET;
    } else {
      process.env.WEBSITE_API_KEY_SECRET = originalSecret;
    }
  });

  it('creates unique, account-scoped API credentials without exposing the key', () => {
    const first = generateWebsiteApiKey();
    const second = generateWebsiteApiKey();

    expect(first).toMatch(/^jpp_site_[A-Za-z0-9_-]{32,}$/);
    expect(second).not.toBe(first);
    expect(createWebsiteApiKeyLookup(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(createWebsiteApiKeyLookup(first)).not.toContain(first);
    expect(websiteApiKeyHint(first)).toContain('••••');
  });

  it('builds a Codex prompt with every CRUD route and server-only key guidance', () => {
    const prompt = buildWebsiteIntegrationPrompt({
      companyName: 'Acme Emlak',
      apiBaseUrl: 'https://app.example.com',
      apiKey: 'jpp_site_one_time_secret',
    });

    expect(prompt).toContain('Acme Emlak');
    expect(prompt).toContain('GET https://app.example.com/api/site/v1/portfolio');
    expect(prompt).toContain('POST https://app.example.com/api/site/v1/portfolio');
    expect(prompt).toContain(
      'PATCH https://app.example.com/api/site/v1/portfolio/{id}'
    );
    expect(prompt).toContain(
      'DELETE https://app.example.com/api/site/v1/portfolio/{id}'
    );
    expect(prompt).toContain('JASMINE_PORTFOLIO_API_KEY');
    expect(prompt).toContain('jpp_site_one_time_secret');
    expect(prompt).toContain('istemci tarafına');
  });
});

describe('website integration validation', () => {
  it('requires the technical details needed for an existing website handoff', () => {
    const result = websiteIntegrationMetadataSchema.safeParse({
      displayName: 'Ana web sitesi',
      websiteUrl: 'https://example.com',
      framework: 'Next.js',
      hostingProvider: 'Vercel',
      portfolioPath: '/portfoyler',
      technicalContactEmail: 'dev@example.com',
      repositoryUrl: '',
      notes: 'App Router kullanılıyor.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsafe or incomplete integration metadata', () => {
    expect(
      websiteIntegrationMetadataSchema.safeParse({
        displayName: 'x',
        websiteUrl: 'javascript:alert(1)',
        framework: '',
        hostingProvider: '',
        portfolioPath: '',
        technicalContactEmail: 'invalid',
      }).success
    ).toBe(false);
  });

  it('validates create and partial update portfolio payloads', () => {
    expect(
      portfolioCreateSchema.safeParse({
        title: 'Deniz manzaralı 2+1',
        price: 250000,
        area: 110,
        status: 'ACTIVE',
      }).success
    ).toBe(true);
    expect(portfolioCreateSchema.safeParse({ title: '' }).success).toBe(false);
    expect(portfolioUpdateSchema.safeParse({ price: -1 }).success).toBe(false);
    expect(portfolioUpdateSchema.safeParse({ status: 'SOLD' }).success).toBe(
      true
    );
    expect(portfolioUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('excludes dependencies, build output and secrets from folder uploads', () => {
    expect(shouldIncludeWebsiteFile('src/app/page.tsx')).toBe(true);
    expect(shouldIncludeWebsiteFile('public/logo.svg')).toBe(true);
    expect(shouldIncludeWebsiteFile('node_modules/react/index.js')).toBe(false);
    expect(shouldIncludeWebsiteFile('.next/server/app.js')).toBe(false);
    expect(shouldIncludeWebsiteFile('.git/config')).toBe(false);
    expect(shouldIncludeWebsiteFile('.env.production')).toBe(false);
    expect(shouldIncludeWebsiteFile('src/.env.example')).toBe(true);
  });

  it('limits repeated API calls per integration and resets after the window', () => {
    const limiter = new WebsiteApiRateLimiter(2, 1_000);

    expect(limiter.check('integration-1', 0)).toBe(true);
    expect(limiter.check('integration-1', 100)).toBe(true);
    expect(limiter.check('integration-1', 200)).toBe(false);
    expect(limiter.check('integration-2', 200)).toBe(true);
    expect(limiter.check('integration-1', 1_100)).toBe(true);
  });
});
