export const INSTAGRAM_WEB_URL = 'https://www.instagram.com/';

type InstagramShareInput = {
  caption: string;
  posterName: string;
  posterUrl: string;
};

type InstagramShareAdapters = {
  openInstagram: (url: string) => void;
  downloadPoster: (url: string, filename: string) => void;
  copyCaption: (caption: string) => Promise<void>;
};

export function instagramPosterFilename(posterName: string): string {
  const safeName = posterName
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeName || 'jasmine_poster'}.jpg`;
}

export async function prepareInstagramShare(
  input: InstagramShareInput,
  adapters: InstagramShareAdapters,
): Promise<{ captionCopied: boolean; filename: string }> {
  const filename = instagramPosterFilename(input.posterName);

  // Open first while the browser still considers this part of the user's click.
  adapters.openInstagram(INSTAGRAM_WEB_URL);
  adapters.downloadPoster(input.posterUrl, filename);

  try {
    await adapters.copyCaption(input.caption);
    return { captionCopied: true, filename };
  } catch {
    return { captionCopied: false, filename };
  }
}
