import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertAllowedSourceUrl,
  isPrivateOrReservedIp,
  validateRedirectTarget,
} from './security';

describe('Avcı v2 kaynak güvenliği', () => {
  it('yalnız izinli HTTPS provider hostlarını kabul eder', () => {
    expect(() =>
      assertAllowedSourceUrl(
        'https://www.sahibinden.com/satilik?address_city=7',
        'SAHIBINDEN'
      )
    ).not.toThrow();
    expect(() =>
      assertAllowedSourceUrl('http://www.sahibinden.com/satilik', 'SAHIBINDEN')
    ).toThrow('HTTPS');
    expect(() =>
      assertAllowedSourceUrl('https://evil.example/satilik', 'SAHIBINDEN')
    ).toThrow('izinli değil');
  });

  it.each([
    '127.0.0.1',
    '10.0.0.2',
    '172.16.0.1',
    '192.168.1.10',
    '169.254.169.254',
    '::1',
    'fc00::1',
  ])('%s özel/rezerve ağ kabul edilir', (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  });

  it('redirect hedefini yeniden doğrular', () => {
    expect(() =>
      validateRedirectTarget(
        'https://www.sahibinden.com/satilik',
        'SAHIBINDEN'
      )
    ).not.toThrow();
    expect(() =>
      validateRedirectTarget('https://localhost/internal', 'SAHIBINDEN')
    ).toThrow();
  });
});
