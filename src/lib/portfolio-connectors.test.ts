import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  isPortfolioSourceType,
  isPrivateNetworkAddress,
} from './portfolio-connectors';

describe('portfolio connector safety', () => {
  it('accepts supported source types', () => {
    expect(isPortfolioSourceType('JASMINE_API')).toBe(true);
    expect(isPortfolioSourceType('WORDPRESS')).toBe(true);
    expect(isPortfolioSourceType('FTP')).toBe(false);
  });

  it('blocks private and loopback IPv4 networks', () => {
    expect(isPrivateNetworkAddress('127.0.0.1')).toBe(true);
    expect(isPrivateNetworkAddress('10.2.3.4')).toBe(true);
    expect(isPrivateNetworkAddress('172.20.1.5')).toBe(true);
    expect(isPrivateNetworkAddress('192.168.1.4')).toBe(true);
    expect(isPrivateNetworkAddress('8.8.8.8')).toBe(false);
  });

  it('blocks private and loopback IPv6 networks', () => {
    expect(isPrivateNetworkAddress('::1')).toBe(true);
    expect(isPrivateNetworkAddress('fd00::1')).toBe(true);
    expect(isPrivateNetworkAddress('fe80::1')).toBe(true);
    expect(isPrivateNetworkAddress('2606:4700:4700::1111')).toBe(false);
  });
});
