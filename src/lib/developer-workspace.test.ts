import { describe, expect, it } from 'vitest';

import { defaultDeveloperSiteContent } from './developer-site';
import {
  buildPortfolioHostname,
  developerWorkspaceRequestSchema,
  normalizeBaseDomain,
  safeSiteSlug,
  upsertSocialAccount,
} from './developer-workspace';

describe('developer workspace helpers', () => {
  it('turns a customer domain into the portfolio subdomain', () => {
    expect(buildPortfolioHostname('https://www.OrnekEmlak.com/ilanlar')).toBe(
      'portfoyler.ornekemlak.com',
    );
    expect(buildPortfolioHostname('portfoyler.ornekemlak.com')).toBe(
      'portfoyler.ornekemlak.com',
    );
  });

  it('rejects local hosts and IP addresses', () => {
    expect(() => normalizeBaseDomain('localhost')).toThrow();
    expect(() => normalizeBaseDomain('127.0.0.1')).toThrow();
  });

  it('creates stable URL-safe temporary slugs', () => {
    expect(safeSiteSlug('Jasmine İstanbul Gayrimenkul')).toBe(
      'jasmine-istanbul-gayrimenkul',
    );
  });

  it('updates one social platform without deleting the others', () => {
    const base = {
      username: '',
      profileUrl: '',
      linkedEmail: '',
      linkedPhone: '',
      twoFactorEnabled: false,
      recoveryReady: false,
      completedStep: 0,
      notes: '',
    };
    const result = upsertSocialAccount(
      [
        { ...base, platform: 'instagram', username: 'eski' },
        { ...base, platform: 'facebook', username: 'sirket' },
      ],
      { ...base, platform: 'instagram', username: 'yeni' },
    );
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.platform === 'instagram')?.username).toBe(
      'yeni',
    );
    expect(result.find((item) => item.platform === 'facebook')?.username).toBe(
      'sirket',
    );
  });

  it('never accepts a password in the social notebook payload', () => {
    const result = developerWorkspaceRequestSchema.safeParse({
      action: 'save-social-account',
      account: {
        platform: 'instagram',
        username: 'sirket',
        profileUrl: '',
        linkedEmail: '',
        linkedPhone: '',
        twoFactorEnabled: true,
        recoveryReady: true,
        completedStep: 4,
        notes: '',
        password: 'plain-text-password',
      },
    });
    expect(result.success).toBe(false);
  });

  it('allows a new hosted site without a custom domain', () => {
    const result = developerWorkspaceRequestSchema.safeParse({
      action: 'save-website',
      mode: 'NEW',
      brandName: 'Jasmine Emlak',
      logoData: '',
      primaryColor: '#0f172a',
      accentColor: '#d4a451',
      contactEmail: '',
      contactPhone: '',
      whatsappPhone: '',
      address: '',
      baseDomain: '',
      selectedTheme: 'midnight-estate',
      siteContent: defaultDeveloperSiteContent('Jasmine Emlak'),
    });

    expect(result.success).toBe(true);
  });

  it('requires a valid domain when connecting an existing website', () => {
    const result = developerWorkspaceRequestSchema.safeParse({
      action: 'save-website',
      mode: 'EXISTING',
      brandName: 'Jasmine Emlak',
      logoData: '',
      primaryColor: '#0f172a',
      accentColor: '#d4a451',
      contactEmail: '',
      contactPhone: '',
      whatsappPhone: '',
      address: '',
      baseDomain: '',
      selectedTheme: 'midnight-estate',
      siteContent: defaultDeveloperSiteContent('Jasmine Emlak'),
    });

    expect(result.success).toBe(false);
  });
});
