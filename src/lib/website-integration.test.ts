import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createWebsiteRequestSignature,
  websiteRequestBodyHash,
  websiteRequestCanonicalValue,
} from './website-integration';

describe('Website Connector v1 request signing', () => {
  it('hashes text and binary request bodies consistently', () => {
    const body = '{"title":"Deniz manzaralı daire"}';
    const expected = createHash('sha256').update(body).digest('hex');

    expect(websiteRequestBodyHash(body)).toBe(expected);
    expect(websiteRequestBodyHash(new TextEncoder().encode(body))).toBe(expected);
  });

  it('uses the documented canonical field order and deterministic signature', () => {
    const canonical = websiteRequestCanonicalValue({
      method: 'post',
      pathWithQuery: '/api/site/v1/portfolio?scope=all',
      timestamp: '1785600000',
      nonce: '8ad87478-6650-45db-a77d-37e8fa0d4287',
      bodyHash: websiteRequestBodyHash('{}'),
    });

    expect(canonical.split('\n').slice(0, 5)).toEqual([
      'v1',
      'POST',
      '/api/site/v1/portfolio?scope=all',
      '1785600000',
      '8ad87478-6650-45db-a77d-37e8fa0d4287',
    ]);
    expect(createWebsiteRequestSignature('secret-key', canonical)).toBe(
      createHmac('sha256', 'secret-key').update(canonical).digest('base64url')
    );
  });

  it('produces a different signature when the nonce changes', () => {
    const base = {
      method: 'GET',
      pathWithQuery: '/api/site/v1/portfolio',
      timestamp: '1785600000',
      bodyHash: websiteRequestBodyHash(''),
    };

    const first = createWebsiteRequestSignature(
      'secret-key',
      websiteRequestCanonicalValue({ ...base, nonce: 'nonce-1' })
    );
    const second = createWebsiteRequestSignature(
      'secret-key',
      websiteRequestCanonicalValue({ ...base, nonce: 'nonce-2' })
    );

    expect(first).not.toBe(second);
  });
});
