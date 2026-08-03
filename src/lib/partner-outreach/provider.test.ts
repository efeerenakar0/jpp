import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('server-only', () => ({}));

import { buildGmailRawMessage } from './google';
import { DisabledPartnerProvider, parsePartnerCsv, verifyPartnerFeed } from './provider';

describe('partner CSV and provider safety', () => {
  it('parses sourced records and rejects rows without a source URL', () => {
    const csv = [
      'name,countryCode,countryName,city,websiteUrl,corporateEmail,sourceUrl,observedAt,languages,specialties',
      'Atlas Realty,DE,Almanya,Berlin,https://atlas.example,partner@atlas.example,https://registry.example/atlas,2026-08-03,de|en,luxury|investment',
    ].join('\n');
    const [partner] = parsePartnerCsv(csv);
    expect(partner).toMatchObject({ displayName: 'Atlas Realty', countryCode: 'DE', domain: 'atlas.example' });
    expect(() => parsePartnerCsv(csv.replace('https://registry.example/atlas', ''))).toThrow(/satır geçersiz/i);
  });

  it('fails closed when a live provider is not configured', async () => {
    await expect(new DisabledPartnerProvider().searchCountry({ countryCode: 'DE', limit: 25 })).rejects.toThrow(/yapılandırılmamış/i);
  });

  it('verifies signed feed bodies without exposing the signing secret', () => {
    process.env.PARTNER_FEED_SIGNING_SECRET = 'partner-feed-test-secret-with-more-than-32-bytes';
    const body = '[]';
    const signature = createHmac('sha256', process.env.PARTNER_FEED_SIGNING_SECRET).update(body).digest('hex');
    expect(verifyPartnerFeed(body, signature)).toBe(true);
    expect(verifyPartnerFeed(body, `${signature.slice(0, 63)}0`)).toBe(false);
  });
});

describe('Gmail MIME output', () => {
  it('creates UTF-8 base64url MIME without leaking headers into the body', () => {
    const raw = buildGmailRawMessage({ to: 'partner@example.com', from: 'sender@example.com', subject: 'İş ortaklığı', body: 'Merhaba\nGüvenli içerik' });
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    expect(decoded).toContain('To: partner@example.com');
    expect(decoded).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(decoded).toContain('Merhaba\r\nGüvenli içerik');
    expect(decoded).not.toContain('Bcc:');
  });
});
