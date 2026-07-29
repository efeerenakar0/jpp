import { describe, expect, it } from 'vitest';

import {
  createPhoneVerificationCodeHash,
  phoneVerificationCodeMatches,
} from './phone-verification-code';

const input = {
  challengeId: 'challenge-1',
  phoneNormalized: '+905551112233',
  code: '482913',
  secret: 'a-test-secret-that-is-long-enough',
};

describe('phone verification code hashing', () => {
  it('never stores the six digit code as the hash', () => {
    const hash = createPhoneVerificationCodeHash(input);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(input.code);
  });

  it('accepts the exact challenge, phone and code tuple', () => {
    const expectedHash = createPhoneVerificationCodeHash(input);

    expect(
      phoneVerificationCodeMatches({ ...input, expectedHash })
    ).toBe(true);
  });

  it('rejects a wrong code, phone, challenge, or secret', () => {
    const expectedHash = createPhoneVerificationCodeHash(input);

    expect(
      phoneVerificationCodeMatches({
        ...input,
        code: '482914',
        expectedHash,
      })
    ).toBe(false);
    expect(
      phoneVerificationCodeMatches({
        ...input,
        phoneNormalized: '+905551112234',
        expectedHash,
      })
    ).toBe(false);
    expect(
      phoneVerificationCodeMatches({
        ...input,
        challengeId: 'challenge-2',
        expectedHash,
      })
    ).toBe(false);
    expect(
      phoneVerificationCodeMatches({
        ...input,
        secret: 'a-different-test-secret-value',
        expectedHash,
      })
    ).toBe(false);
  });
});
