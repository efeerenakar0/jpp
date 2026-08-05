import { describe, expect, it } from 'vitest';

import { buildViewingReplyReceipt } from './whatsapp-operation-reply';

describe('buildViewingReplyReceipt', () => {
  it('does not claim success for stale operations', () => {
    expect(
      buildViewingReplyReceipt(
        { handled: true, mutated: false, stale: true },
        'EMPLOYEE'
      )
    ).toMatchObject({
      kind: 'NO_CHANGE',
      text: expect.stringContaining('artık açık değil'),
    });
  });

  it('explains invalid appointment dates instead of confirming a mutation', () => {
    expect(
      buildViewingReplyReceipt(
        { handled: true, mutated: false, invalidDate: true },
        'EMPLOYEE'
      )
    ).toMatchObject({
      kind: 'CLARIFICATION',
      text: expect.stringContaining('tarih ve saati anlayamadım'),
    });
  });

  it('only confirms replies that actually mutated the linked operation', () => {
    expect(
      buildViewingReplyReceipt(
        { handled: true, mutated: true, action: 'ACCEPTED' },
        'OWNER'
      )
    ).toMatchObject({
      kind: 'CONFIRMED',
      text: 'Kararınız doğrulandı ve ilgili operasyona uygulandı.',
    });
    expect(
      buildViewingReplyReceipt({ handled: true, mutated: false }, 'OWNER')
    ).toMatchObject({
      kind: 'NO_CHANGE',
      text: expect.stringContaining('hiçbir kayıt değiştirilmedi'),
    });
  });
});
