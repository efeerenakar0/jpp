import 'server-only';

import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';
import type { SourceProvider } from './types';

const PROVIDER_HOSTS: Record<SourceProvider, ReadonlySet<string>> = {
  SAHIBINDEN: new Set(['sahibinden.com', 'www.sahibinden.com']),
  FIXTURE: new Set(['fixture.local']),
};

function normalizeIp(value: string) {
  return value.toLowerCase().replace(/^\[|\]$/g, '');
}

export function isPrivateOrReservedIp(value: string) {
  const ip = normalizeIp(value);
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0 ||
      parts[0] >= 224
    );
  }
  if (isIP(ip) === 6) {
    return (
      ip === '::1' ||
      ip === '::' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb')
    );
  }
  return false;
}

export function assertAllowedSourceUrl(
  value: string,
  provider: SourceProvider
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Kaynak URL geçersiz.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Kaynak URL HTTPS kullanmalıdır.');
  }
  if (url.username || url.password) {
    throw new Error('Kaynak URL kimlik bilgisi içeremez.');
  }
  const hostname = url.hostname.toLowerCase();
  if (!PROVIDER_HOSTS[provider].has(hostname)) {
    throw new Error('Kaynak host bu provider için izinli değil.');
  }
  if (hostname === 'localhost' || isPrivateOrReservedIp(hostname)) {
    throw new Error('Özel veya rezerve ağ hedefleri kullanılamaz.');
  }
  return url;
}

export function validateRedirectTarget(
  value: string,
  provider: SourceProvider
) {
  return assertAllowedSourceUrl(value, provider);
}

export function assertAllowedMediaUrl(
  value: string,
  provider: SourceProvider
) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Medya URL güvenli HTTPS biçiminde olmalıdır.');
  }
  const hostname = url.hostname.toLowerCase();
  const allowed =
    provider === 'FIXTURE'
      ? hostname === 'images.example.test'
      : hostname === 'sahibinden.com' ||
        hostname.endsWith('.sahibinden.com');
  if (!allowed || isPrivateOrReservedIp(hostname)) {
    throw new Error('Medya host bu provider için izinli değil.');
  }
  return url;
}

export async function assertPublicSourceUrl(
  value: string,
  provider: SourceProvider
) {
  const url = assertAllowedSourceUrl(value, provider);
  if (provider === 'FIXTURE') return url;

  const addresses = [
    ...(await resolve4(url.hostname).catch(() => [])),
    ...(await resolve6(url.hostname).catch(() => [])),
  ];
  if (
    addresses.length === 0 ||
    addresses.some((address) => isPrivateOrReservedIp(address))
  ) {
    throw new Error('Kaynak host güvenli bir genel IP adresine çözülmedi.');
  }
  return url;
}
