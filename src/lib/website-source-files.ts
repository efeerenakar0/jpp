export const MAX_SITE_SOURCE_BYTES = 30 * 1024 * 1024;
export const MAX_SITE_SOURCE_FILES = 2500;

export function shouldIncludeWebsiteFile(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  const excludedDirectories = new Set([
    '.git',
    '.next',
    '.turbo',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.cache',
  ]);

  if (segments.some((segment) => excludedDirectories.has(segment))) {
    return false;
  }

  const fileName = segments.at(-1)?.toLocaleLowerCase('en-US') || '';
  if (fileName === '.env.example' || fileName === '.env.sample') {
    return true;
  }
  return !fileName.startsWith('.env');
}

export function safeWebsiteArchiveName(fileName: string) {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized.toLocaleLowerCase('en-US').endsWith('.zip')
    ? normalized
    : `${normalized || 'website-source'}.zip`;
}
