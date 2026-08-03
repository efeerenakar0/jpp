import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

type Resolver = (hostname: string) => Promise<string[]>;

function unsafeIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const value = address.toLowerCase();
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb')
  );
}

async function defaultResolve(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertSafePartnerSourceUrl(
  value: string,
  options: { resolve?: Resolver } = {}
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Geçerli bir kaynak adresi girin.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Partner kaynakları yalnızca HTTPS kullanabilir.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Yerel veya özel ağ adreslerine erişilemez.');
  }
  const addresses = isIP(hostname)
    ? [hostname]
    : await (options.resolve ?? defaultResolve)(hostname);
  if (!addresses.length || addresses.some(unsafeIp)) {
    throw new Error('Kaynak adresi güvenli bir genel ağa çözülmüyor.');
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  return url.toString();
}
