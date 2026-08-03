import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  dedupePartnerCandidates,
  normalizeDomain,
  normalizePartnerEmail,
} from './normalization';
import { scorePartnerCandidate } from './scoring';
import { evaluatePartnerOutreachPolicy } from './policy';
import { verificationStatusForImportedSource } from './policy';
import {
  decryptPartnerCredential,
  emailSuppressionHmac,
  encryptPartnerCredential,
  maskPartnerEmail,
} from './crypto';
import {
  createPartnerOAuthState,
  readPartnerOAuthState,
} from './oauth-state';
import {
  draftContentHash,
  parsePartnerDraft,
} from './ai-draft';
import { assertSafePartnerSourceUrl } from './ssrf';
import {
  classifyPartnerEmailFailure,
  partnerFollowUpSequence,
  nextPartnerEmailRetryAt,
} from './outbox-policy';

describe('partner normalization and deduplication', () => {
  it('normalizes international domains and role mailboxes', () => {
    expect(normalizeDomain('HTTPS://WWW.Example.COM.tr/path')).toBe(
      'example.com.tr'
    );
    expect(normalizePartnerEmail(' Sales@Example.COM ')).toBe(
      'sales@example.com'
    );
  });

  it('keeps the strongest candidate while merging evidence sources', () => {
    const candidates = dedupePartnerCandidates([
      {
        externalId: 'directory-1',
        name: 'Atlas Realty',
        city: 'Berlin',
        domain: 'https://atlas.example',
        sourceIds: ['source-a'],
        completeness: 40,
      },
      {
        externalId: 'feed-99',
        name: 'Atlas Realty GmbH',
        city: 'Berlin',
        domain: 'atlas.example',
        sourceIds: ['source-b'],
        completeness: 85,
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe('Atlas Realty GmbH');
    expect(candidates[0]?.sourceIds).toEqual(['source-a', 'source-b']);
  });
});

describe('partner scoring', () => {
  it('uses the versioned 25/20/20/15/10/10 rubric deterministically', () => {
    const now = new Date('2026-08-03T12:00:00.000Z');
    const score = scorePartnerCandidate({
      targetFit: 0.8,
      internationalFit: 0.75,
      legalVerification: 1,
      reviewAverage: 4.7,
      reviewCount: 120,
      activityAt: new Date('2026-07-30T12:00:00.000Z'),
      corporateContactVerified: true,
      evidenceCoverage: 0.9,
      now,
    });

    expect(score.version).toBe('partner-score-v1');
    expect(score.breakdown.targetFit).toBe(20);
    expect(score.breakdown.internationalFit).toBe(15);
    expect(score.breakdown.legalVerification).toBe(20);
    expect(score.total).toBeGreaterThan(80);
    expect(score.confidence).toBe(90);
    expect(score.explanations.length).toBeGreaterThanOrEqual(6);
  });

  it('does not treat missing evidence as positive', () => {
    const score = scorePartnerCandidate({
      targetFit: null,
      internationalFit: null,
      legalVerification: null,
      reviewAverage: null,
      reviewCount: null,
      activityAt: null,
      corporateContactVerified: false,
      evidenceCoverage: 0,
      now: new Date('2026-08-03T12:00:00.000Z'),
    });
    expect(score.total).toBe(0);
    expect(score.confidence).toBe(0);
  });
});

describe('partner country policy and suppression', () => {
  const base = {
    countryPolicyStatus: 'ALLOWED' as const,
    corporateEmailVerified: true,
    humanApproved: true,
    mailboxConnected: true,
    draftHashMatchesApproval: true,
    suppressed: false,
    dailyCompanyQuotaAvailable: true,
    dailyDomainQuotaAvailable: true,
    dailyMailboxQuotaAvailable: true,
  };

  it('fails closed for unknown country policy', () => {
    const result = evaluatePartnerOutreachPolicy({
      ...base,
      countryPolicyStatus: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('COUNTRY_REVIEW_REQUIRED');
  });

  it('blocks suppressed and edited-after-approval recipients', () => {
    const result = evaluatePartnerOutreachPolicy({
      ...base,
      suppressed: true,
      draftHashMatchesApproval: false,
    });
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(['SUPPRESSED', 'APPROVAL_STALE'])
    );
  });

  it('treats owner-attested CSV and signed feeds as explicit verification paths', () => {
    expect(verificationStatusForImportedSource('MANUAL_CSV')).toBe('MANUALLY_VERIFIED');
    expect(verificationStatusForImportedSource('PARTNER_FEED')).toBe('SOURCE_VERIFIED');
    expect(verificationStatusForImportedSource('FIRST_PARTY_APPLICATION')).toBe('UNVERIFIED');
  });
});

describe('partner credential and identity security', () => {
  it('encrypts credentials and verifies deterministic suppression identities', () => {
    process.env.PARTNER_CREDENTIAL_ENCRYPTION_KEY =
      'test-partner-encryption-key-with-at-least-32-bytes';
    const encrypted = encryptPartnerCredential('refresh-token-secret');
    expect(encrypted).not.toContain('refresh-token-secret');
    expect(decryptPartnerCredential(encrypted)).toBe('refresh-token-secret');
    expect(emailSuppressionHmac(' Sales@Example.com ')).toBe(
      emailSuppressionHmac('sales@example.com')
    );
    expect(maskPartnerEmail('sales@example.com')).toBe('s***s@example.com');
  });

  it('signs, scopes and expires OAuth state', () => {
    process.env.PARTNER_CREDENTIAL_ENCRYPTION_KEY =
      'test-partner-encryption-key-with-at-least-32-bytes';
    const state = createPartnerOAuthState({
      accountId: 'tenant-a',
      principalId: 'tenant-a',
      csrfToken: 'csrf-value',
      now: 1_000,
    });
    expect(readPartnerOAuthState(state, 1_001)).toMatchObject({
      accountId: 'tenant-a',
      principalId: 'tenant-a',
      csrfToken: 'csrf-value',
    });
    expect(readPartnerOAuthState(state, 11 * 60 * 1_000)).toBeNull();
    expect(readPartnerOAuthState(`${state}x`, 1_001)).toBeNull();
  });
});

describe('partner AI draft validation', () => {
  it('accepts only sourced structured claims and hashes editable content', () => {
    const raw = JSON.stringify({
      subject: 'Berlin portföy iş birliği',
      body: 'Atlas Realty ile doğrulanmış uluslararası portföy deneyiminiz için yazıyoruz.',
      language: 'de',
      turkishTranslation: 'Doğrulanmış deneyiminiz için yazıyoruz.',
      personalizationEvidence: [
        {
          claim: 'uluslararası portföy deneyimi',
          sourceId: 'src-1',
          sourceUrl: 'https://atlas.example/about',
        },
      ],
      warnings: [],
    });
    const parsed = parsePartnerDraft(raw, new Set(['src-1']));
    expect(parsed.language).toBe('de');
    expect(draftContentHash(parsed.subject, parsed.body)).not.toBe(
      draftContentHash(`${parsed.subject}!`, parsed.body)
    );
  });

  it('rejects evidence references that were not supplied to the model', () => {
    expect(() =>
      parsePartnerDraft(
        JSON.stringify({
          subject: 'Hello',
          body: 'Body content',
          language: 'en',
          turkishTranslation: 'Türkçe içerik',
          personalizationEvidence: [
            {
              claim: 'unsupported',
              sourceId: 'invented',
              sourceUrl: 'https://example.com',
            },
          ],
          warnings: [],
        }),
        new Set(['verified'])
      )
    ).toThrow(/doğrulanmış kaynak/i);
  });
});

describe('partner source SSRF protection', () => {
  it.each([
    'http://127.0.0.1/internal',
    'http://localhost:3000',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.4/private',
    'ftp://example.com/file',
  ])('rejects unsafe URL %s', async (url) => {
    await expect(assertSafePartnerSourceUrl(url)).rejects.toThrow();
  });

  it('accepts a public HTTPS URL when DNS resolves publicly', async () => {
    await expect(
      assertSafePartnerSourceUrl('https://example.com/feed.json', {
        resolve: async () => ['93.184.216.34'],
      })
    ).resolves.toBe('https://example.com/feed.json');
  });
});

describe('partner email outbox policy', () => {
  it('retries temporary failures with bounded exponential backoff', () => {
    const now = new Date('2026-08-03T10:00:00.000Z');
    expect(classifyPartnerEmailFailure(429)).toBe('RETRY');
    expect(classifyPartnerEmailFailure(400)).toBe('PERMANENT_FAILURE');
    expect(nextPartnerEmailRetryAt(now, 3).getTime()).toBe(
      now.getTime() + 8 * 60_000
    );
  });

  it('allows one initial contact plus at most two manually approved follow-ups', () => {
    expect(partnerFollowUpSequence(0)).toEqual({ allowed: true, followUpNumber: 0 });
    expect(partnerFollowUpSequence(1)).toEqual({ allowed: true, followUpNumber: 1 });
    expect(partnerFollowUpSequence(2)).toEqual({ allowed: true, followUpNumber: 2 });
    expect(partnerFollowUpSequence(3)).toEqual({ allowed: false, followUpNumber: 3 });
  });
});
