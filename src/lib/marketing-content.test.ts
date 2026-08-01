import { describe, expect, it } from 'vitest';
import {
  deterministicCampaign,
  parseGeneratedCampaign,
} from './marketing-content';
import { DEFAULT_MARKETING_CHANNELS } from './marketing-channels';

const property = {
  id: 'property-1',
  title: 'Deniz Manzaralı 3+1 Daire',
  location: 'Alanya, Kestel',
  price: 8_500_000,
  roomCount: '3+1',
  area: 165,
  description: 'Geniş balkonlu daire.',
  imageUrl: 'https://example.com/property.jpg',
  referenceCode: 'JG-101',
};

describe('marketing content', () => {
  it('produces the complete default-channel fallback without inventing unavailable data', () => {
    const campaign = deterministicCampaign({
      companyName: 'Jasmine Group',
      property,
      objective: 'Nitelikli talep toplama',
      audience: 'Alanya yatırımcıları',
      tone: 'professional',
      targetUrl: 'https://example.com/portfoy/1',
    });

    expect(campaign.adCopies.map((copy) => copy.platform).sort()).toEqual(
      [...DEFAULT_MARKETING_CHANNELS].sort()
    );
    expect(campaign.posterHeadline).toContain('Deniz Manzaralı');
    expect(campaign.adCopies.every((copy) => copy.targetUrl?.includes('/portfoy/1'))).toBe(true);
  });

  it('keeps fallback channels when AI returns an incomplete payload', () => {
    const fallback = deterministicCampaign({
      companyName: 'Jasmine Group',
      property,
      objective: 'Talep toplama',
      audience: 'Alıcılar',
      tone: 'warm',
    });
    const generated = parseGeneratedCampaign(
      JSON.stringify({
        name: 'AI kampanyası',
        adCopies: [{ platform: 'INSTAGRAM', headline: 'Yeni başlık', body: 'Yeni metin' }],
      }),
      fallback
    );

    expect(generated.name).toBe('AI kampanyası');
    expect(generated.adCopies).toHaveLength(DEFAULT_MARKETING_CHANNELS.length);
    expect(generated.adCopies.find((copy) => copy.platform === 'INSTAGRAM')?.body).toBe('Yeni metin');
    expect(generated.adCopies.find((copy) => copy.platform === 'WHATSAPP')?.body).toBeTruthy();
  });
});
