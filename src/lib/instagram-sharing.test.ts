import { describe, expect, it, vi } from 'vitest';
import {
  INSTAGRAM_WEB_URL,
  prepareInstagramShare,
} from './instagram-sharing';

describe('Instagram poster sharing', () => {
  it('opens the safe Instagram home page after preparing the poster and caption', async () => {
    const calls: string[] = [];

    const result = await prepareInstagramShare(
      {
        caption: 'Deniz manzaralı villa #alanya',
        posterName: 'Kestel / Deniz Manzaralı Villa',
        posterUrl: 'data:image/jpeg;base64,poster',
      },
      {
        openInstagram: (url) => calls.push(`open:${url}`),
        downloadPoster: (url, filename) => calls.push(`download:${url}:${filename}`),
        copyCaption: async (caption) => {
          calls.push(`copy:${caption}`);
        },
      },
    );

    expect(INSTAGRAM_WEB_URL).toBe('https://www.instagram.com/');
    expect(INSTAGRAM_WEB_URL).not.toContain('/create/');
    expect(calls).toEqual([
      `open:${INSTAGRAM_WEB_URL}`,
      'download:data:image/jpeg;base64,poster:Kestel_Deniz_Manzaralı_Villa.jpg',
      'copy:Deniz manzaralı villa #alanya',
    ]);
    expect(result).toEqual({
      captionCopied: true,
      filename: 'Kestel_Deniz_Manzaralı_Villa.jpg',
    });
  });

  it('keeps the Instagram and download steps working if clipboard access is denied', async () => {
    const openInstagram = vi.fn();
    const downloadPoster = vi.fn();

    const result = await prepareInstagramShare(
      {
        caption: 'Hazır açıklama',
        posterName: 'Poster',
        posterUrl: 'blob:poster',
      },
      {
        openInstagram,
        downloadPoster,
        copyCaption: async () => {
          throw new Error('Clipboard denied');
        },
      },
    );

    expect(openInstagram).toHaveBeenCalledWith(INSTAGRAM_WEB_URL);
    expect(downloadPoster).toHaveBeenCalledWith('blob:poster', 'Poster.jpg');
    expect(result.captionCopied).toBe(false);
  });

  it('uses a stable fallback filename when the poster name has no usable characters', async () => {
    const result = await prepareInstagramShare(
      {
        caption: '',
        posterName: '---',
        posterUrl: 'blob:poster',
      },
      {
        openInstagram: vi.fn(),
        downloadPoster: vi.fn(),
        copyCaption: vi.fn(),
      },
    );

    expect(result.filename).toBe('jasmine_poster.jpg');
  });
});
