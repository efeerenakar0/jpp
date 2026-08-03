import { describe, expect, it } from 'vitest';

import {
  assertAdPublicationTransition,
  canClaimManualPublication,
} from './ad-publication';

describe('manual advertising publication', () => {
  it('never claims publication without external evidence', () => {
    expect(canClaimManualPublication({ externalUrl: null, proofUrl: null })).toBe(
      false
    );
    expect(
      canClaimManualPublication({
        externalUrl: 'https://ads.example/campaign/42',
        proofUrl: null,
      })
    ).toBe(true);
  });

  it('supports only truthful export/manual-confirm transitions', () => {
    expect(() =>
      assertAdPublicationTransition('DRAFT', 'READY_TO_PUBLISH')
    ).not.toThrow();
    expect(() =>
      assertAdPublicationTransition('EXPORTED', 'MANUALLY_CONFIRMED', {
        externalUrl: null,
        proofUrl: null,
      })
    ).toThrow(/kanıt/iu);
    expect(() =>
      assertAdPublicationTransition('EXPORTED', 'MANUALLY_CONFIRMED', {
        externalUrl: 'https://ads.example/campaign/42',
        proofUrl: null,
      })
    ).not.toThrow();
  });
});
