import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createCalendarOAuthState,
  decryptCalendarToken,
  encryptCalendarToken,
  readCalendarOAuthState,
} from './calendar-crypto';

const previousSecret = process.env.FABRIKA_SESSION_SECRET;

beforeAll(() => {
  process.env.FABRIKA_SESSION_SECRET =
    'test-calendar-secret-with-enough-random-looking-characters';
});

afterAll(() => {
  if (previousSecret === undefined) {
    delete process.env.FABRIKA_SESSION_SECRET;
  } else {
    process.env.FABRIKA_SESSION_SECRET = previousSecret;
  }
});

describe('calendar token security', () => {
  it('Google belirtecini şifreleyip geri açar', () => {
    const encrypted = encryptCalendarToken('refresh-token-value');
    expect(encrypted).not.toContain('refresh-token-value');
    expect(decryptCalendarToken(encrypted)).toBe('refresh-token-value');
  });

  it('OAuth state içeriğini imzalar ve süresini doğrular', () => {
    const now = Date.now();
    const state = createCalendarOAuthState({
      accountId: 'company-1',
      principalId: 'owner-1',
      now,
    });
    expect(readCalendarOAuthState(state, now + 1000)).toMatchObject({
      accountId: 'company-1',
      principalId: 'owner-1',
    });
    expect(readCalendarOAuthState(state, now + 11 * 60 * 1000)).toBeNull();
  });

  it('değiştirilmiş OAuth state değerini reddeder', () => {
    const state = createCalendarOAuthState({
      accountId: 'company-1',
      principalId: 'owner-1',
    });
    expect(readCalendarOAuthState(`${state}x`)).toBeNull();
  });
});
