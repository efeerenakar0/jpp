import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFabrikaSessionToken,
  readFabrikaSessionToken,
  verifyFabrikaSessionToken,
} from './fabrika-auth';

const previousSecret = process.env.FABRIKA_SESSION_SECRET;

beforeAll(() => {
  process.env.FABRIKA_SESSION_SECRET =
    'test-only-fabrika-session-secret-with-sufficient-length';
});

afterAll(() => {
  if (previousSecret === undefined) {
    delete process.env.FABRIKA_SESSION_SECRET;
  } else {
    process.env.FABRIKA_SESSION_SECRET = previousSecret;
  }
});

describe('Fabrika session tokens', () => {
  it('patron kimliğini imzalı oturuma taşır', () => {
    const token = createFabrikaSessionToken({
      account: {
        id: 'account-owner',
        companyName: 'Akar Group',
        sessionVersion: 4,
      },
      principal: {
        type: 'OWNER',
        id: 'account-owner',
        name: 'Akar Patron',
        sessionVersion: 4,
      },
    });
    const payload = readFabrikaSessionToken(token);

    expect(payload).toMatchObject({
      accountId: 'account-owner',
      accountSessionVersion: 4,
      principalType: 'OWNER',
      principalId: 'account-owner',
      principalName: 'Akar Patron',
      principalSessionVersion: 4,
    });
    expect(verifyFabrikaSessionToken(token)).toBe(true);
  });

  it('çalışan kimliğini şirket oturumundan ayrı sürümle taşır', () => {
    const token = createFabrikaSessionToken({
      account: {
        id: 'account-employee',
        companyName: 'Akar Group',
        sessionVersion: 2,
      },
      principal: {
        type: 'EMPLOYEE',
        id: 'member-1',
        name: 'Ayşe Yılmaz',
        sessionVersion: 7,
      },
    });

    expect(readFabrikaSessionToken(token)).toMatchObject({
      accountId: 'account-employee',
      accountSessionVersion: 2,
      principalType: 'EMPLOYEE',
      principalId: 'member-1',
      principalSessionVersion: 7,
    });
  });

  it('değiştirilmiş imzayı reddeder', () => {
    const token = createFabrikaSessionToken({
      account: {
        id: 'account-tamper',
        companyName: 'Akar Group',
        sessionVersion: 1,
      },
      principal: {
        type: 'OWNER',
        id: 'account-tamper',
        name: 'Patron',
        sessionVersion: 1,
      },
    });
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    expect(readFabrikaSessionToken(tamperedToken)).toBeNull();
    expect(verifyFabrikaSessionToken(tamperedToken)).toBe(false);
  });
});
