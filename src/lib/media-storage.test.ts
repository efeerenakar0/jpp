import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hunting-v2/security', () => ({
  isPrivateOrReservedIp: () => false,
}));

vi.mock('@vercel/blob', () => ({ del: vi.fn(), put: vi.fn() }));
import { del, put } from '@vercel/blob';
import {
  deleteStudioPosterReferences,
  MediaValidationError,
  normalizeMediaFileName,
  publishStudioPosterReference,
  persistStudioPosterOutput,
  PROPERTY_MEDIA_MAX_FILE_BYTES,
  validatePropertyMediaFiles,
} from './media-storage';

const mockedPut = vi.mocked(put);
const mockedDel = vi.mocked(del);

function imageFile(
  name: string,
  type = 'image/jpeg',
  size = 4
) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validatePropertyMediaFiles', () => {
  it('JPG, PNG, WebP ve AVIF görselleri kabul eder', () => {
    expect(() =>
      validatePropertyMediaFiles([
        imageFile('a.jpg'),
        imageFile('b.png', 'image/png'),
        imageFile('c.webp', 'image/webp'),
        imageFile('d.avif', 'image/avif'),
      ])
    ).not.toThrow();
  });

  it('geçersiz MIME ve büyük dosyayı reddeder', () => {
    expect(() =>
      validatePropertyMediaFiles([imageFile('script.svg', 'image/svg+xml')])
    ).toThrow(MediaValidationError);
    expect(() =>
      validatePropertyMediaFiles([
        imageFile('large.jpg', 'image/jpeg', PROPERTY_MEDIA_MAX_FILE_BYTES + 1),
      ])
    ).toThrow(/15 MB/);
  });

  it('tek istekte on ikiden fazla dosyayı reddeder', () => {
    expect(() =>
      validatePropertyMediaFiles(
        Array.from({ length: 13 }, (_, index) => imageFile(`${index}.jpg`))
      )
    ).toThrow(/12/);
  });
});

describe('normalizeMediaFileName', () => {
  it('istemci dosya adını depolama yolu için güvenli hale getirir', () => {
    expect(normalizeMediaFileName('../../ Villa Görseli (1).jpg')).toBe(
      '..-..-Villa-Go-rseli-1-.jpg'
    );
  });
});

describe('persistStudioPosterOutput', () => {
  it('AI posterini sabit ve tekrar kullanılabilir bir Blob yoluna kaydeder', async () => {
    mockedPut.mockResolvedValue({
      url: 'https://blob.example/studio-posters/poster.jpg',
      downloadUrl: 'https://blob.example/studio-posters/poster.jpg?download=1',
      pathname:
        'studio-posters/company-a/generation-a/attempt-a-checksum-post.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
      etag: 'poster-etag',
    });

    const bytes = Buffer.from([255, 216, 255, 217]);
    const stored = await persistStudioPosterOutput({
      companyAccountId: 'company-a',
      generationId: 'generation-a',
      attemptId: 'attempt-a',
      bytes,
      format: 'post',
    });

    expect(mockedPut).toHaveBeenCalledWith(
      expect.stringMatching(
        /^studio-posters\/company-a\/generation-a\/attempt-a-[a-f0-9]{20}-post\.jpg$/
      ),
      bytes,
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/jpeg',
      }
    );
    expect(stored).toMatchObject({
      url: 'https://blob.example/studio-posters/poster.jpg',
      mimeType: 'image/jpeg',
      byteSize: 4,
    });
  });

  it('Bannerbear referansını geçici, tenant kapsamlı bir Blob yoluna koyar ve temizler', async () => {
    mockedPut.mockResolvedValue({
      url: 'https://blob.example/studio-poster-references/source.jpg',
      downloadUrl: 'https://blob.example/studio-poster-references/source.jpg?download=1',
      pathname: 'studio-poster-references/company-a/attempt-a/hero-checksum.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
      etag: 'reference-etag',
    });
    mockedDel.mockResolvedValue(undefined);

    const reference = await publishStudioPosterReference({
      companyAccountId: 'company-a',
      attemptId: 'attempt-a',
      role: 'hero',
      bytes: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
    });
    await deleteStudioPosterReferences([reference.storageKey, reference.storageKey]);

    expect(reference.url).toContain('studio-poster-references');
    expect(mockedPut).toHaveBeenCalledWith(
      expect.stringMatching(/^studio-poster-references\/company-a\/attempt-a\/hero-[a-f0-9]{20}\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({ access: 'public', contentType: 'image/jpeg' })
    );
    expect(mockedDel).toHaveBeenCalledWith([reference.storageKey]);
  });
});
