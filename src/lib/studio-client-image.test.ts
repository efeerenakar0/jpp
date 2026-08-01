import { describe, expect, it, vi } from 'vitest';

import {
  MAX_STUDIO_UPLOAD_BYTES,
  prepareStudioImageUpload,
} from './studio-client-image';

describe('studio client image preparation', () => {
  it('keeps an already small supported image unchanged', async () => {
    const file = new File(['small'], 'photo.jpg', { type: 'image/jpeg' });
    const transform = vi.fn();

    await expect(
      prepareStudioImageUpload(file, { transform })
    ).resolves.toBe(file);
    expect(transform).not.toHaveBeenCalled();
  });

  it('compresses oversized images before sending them to a route handler', async () => {
    const file = new File(
      [new Uint8Array(MAX_STUDIO_UPLOAD_BYTES + 1)],
      'large.png',
      { type: 'image/png' }
    );
    const transform = vi.fn().mockResolvedValue(
      new Blob(['compressed'], { type: 'image/jpeg' })
    );

    const prepared = await prepareStudioImageUpload(file, { transform });

    expect(prepared).not.toBe(file);
    expect(prepared.type).toBe('image/jpeg');
    expect(prepared.name).toBe('large_studio.jpg');
    expect(prepared.size).toBeLessThan(MAX_STUDIO_UPLOAD_BYTES);
  });

  it('rejects unsupported image formats', async () => {
    const file = new File(['gif'], 'photo.gif', { type: 'image/gif' });

    await expect(prepareStudioImageUpload(file)).rejects.toThrow(
      'JPG, PNG veya WEBP'
    );
  });
});
