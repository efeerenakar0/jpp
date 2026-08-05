import { describe, expect, it } from 'vitest';
import { toCustomerWebsiteIntegration } from './website-integration-customer';

describe('toCustomerWebsiteIntegration', () => {
  it('müşteriye yalnız teslim durumu alanlarını verir ve bütün sırları ayıklar', () => {
    const result = toCustomerWebsiteIntegration({
      id: 'integration-1',
      displayName: 'Acme Emlak',
      websiteUrl: 'https://acme.test',
      framework: 'Next.js',
      hostingProvider: 'Vercel',
      portfolioPath: '/portfoyler',
      technicalContactEmail: 'tech@acme.test',
      repositoryUrl: null,
      notes: null,
      sourceFileName: 'source.zip',
      sourceSize: 42,
      status: 'SUBMITTED',
      deliveryType: null,
      previewUrl: null,
      finalUrl: null,
      approvedAt: null,
      lastError: null,
      submittedAt: new Date('2026-08-04T10:00:00.000Z'),
      deliveredAt: null,
      apiKeyLookup: 'lookup-secret',
      apiKeyHint: '...ABCD',
      promptTemplate: 'secret prompt',
      apiKeys: [{ keyHint: '...EFGH' }],
      promptVersions: [{ promptTemplate: 'secret prompt v2' }],
      versions: [
        {
          id: 'version-1',
          version: 1,
          resultFileName: null,
          resultSha256: null,
          qaStatus: 'PENDING',
          previewUrl: null,
          finalUrl: null,
          approvedAt: null,
          deliveredAt: null,
          sourceBlobPathname: 'private/source.zip',
          resultBlobPathname: 'private/result.zip',
          workOrder: 'secret work order',
        },
      ],
    });

    expect(result).toMatchObject({
      id: 'integration-1',
      displayName: 'Acme Emlak',
      status: 'SUBMITTED',
      versions: [{ id: 'version-1', version: 1, qaStatus: 'PENDING' }],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /apiKey|keyHint|lookup-secret|prompt|workOrder|BlobPathname|secret/i
    );
  });
});
