import { createHmac, timingSafeEqual } from 'node:crypto';

export function createPhoneVerificationCodeHash(input: {
  challengeId: string;
  phoneNormalized: string;
  code: string;
  secret: string;
}) {
  return createHmac('sha256', input.secret)
    .update(
      `${input.challengeId}:${input.phoneNormalized}:${input.code}`,
      'utf8'
    )
    .digest('hex');
}

export function phoneVerificationCodeMatches(input: {
  challengeId: string;
  phoneNormalized: string;
  code: string;
  expectedHash: string;
  secret: string;
}) {
  const actual = Buffer.from(
    createPhoneVerificationCodeHash(input),
    'hex'
  );
  const expected = Buffer.from(input.expectedHash, 'hex');
  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
