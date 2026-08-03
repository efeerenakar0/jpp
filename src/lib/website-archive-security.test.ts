import { describe, expect, it } from 'vitest';

import {
  WebsiteArchiveSecurityError,
  validateWebsiteArchiveEntries,
} from './website-archive-security';

const valid = {
  name: 'src/app/page.tsx',
  compressedSize: 400,
  uncompressedSize: 1_000,
  directory: false,
  unixMode: 0o100644,
};

describe('website ZIP security', () => {
  it.each([
    '../secret.env',
    'src/../../secret.env',
    '/etc/passwd',
    'C:\\Windows\\system.ini',
    '\\\\server\\share\\file',
  ])('rejects unsafe archive path %s', (name) => {
    expect(() =>
      validateWebsiteArchiveEntries([{ ...valid, name }])
    ).toThrow(WebsiteArchiveSecurityError);
  });

  it('rejects symlinks, file-count bombs and expanded-size bombs', () => {
    expect(() =>
      validateWebsiteArchiveEntries([
        { ...valid, name: 'link', unixMode: 0o120777 },
      ])
    ).toThrow(/sembolik/iu);

    expect(() =>
      validateWebsiteArchiveEntries(
        Array.from({ length: 2_501 }, (_, index) => ({
          ...valid,
          name: `src/${index}.ts`,
        }))
      )
    ).toThrow(/dosya/iu);

    expect(() =>
      validateWebsiteArchiveEntries([
        {
          ...valid,
          compressedSize: 10,
          uncompressedSize: 220 * 1024 * 1024,
        },
      ])
    ).toThrow(/açılmış/iu);
  });

  it('accepts a bounded normal source archive manifest', () => {
    const result = validateWebsiteArchiveEntries([
      valid,
      { ...valid, name: 'public/logo.svg', uncompressedSize: 8_000 },
      { ...valid, name: 'src/', directory: true, uncompressedSize: 0 },
    ]);

    expect(result.fileCount).toBe(2);
    expect(result.totalUncompressedSize).toBe(9_000);
  });
});
