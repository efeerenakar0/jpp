import { describe, expect, it } from 'vitest';

import { detectStudioImageMimeType } from './studio-image-format';

describe('studio image signature detection', () => {
  it('detects JPEG, PNG and WEBP from their bytes instead of the filename', () => {
    expect(
      detectStudioImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    ).toBe('image/jpeg');
    expect(
      detectStudioImageMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png');
    expect(
      detectStudioImageMimeType(Buffer.from('RIFF1234WEBPpayload'))
    ).toBe('image/webp');
  });

  it('rejects unsupported or spoofed image bytes', () => {
    expect(detectStudioImageMimeType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectStudioImageMimeType(Buffer.from('not an image'))).toBeNull();
  });
});
