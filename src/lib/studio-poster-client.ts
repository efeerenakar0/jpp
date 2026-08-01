export type PosterMode = 'faithful' | 'creative';

type PosterApiResult = {
  backgroundDataUrl?: string;
  fallbackUsed?: boolean;
  warning?: string;
  logoDataUrl?: string | null;
};

export type ResolvedPosterBackground = {
  backgroundUrl: string;
  effectiveMode: PosterMode;
  fallbackUsed: boolean;
  warning: string | null;
  logoDataUrl: string | null;
};

export async function resolvePosterBackground({
  mode,
  localBackgroundUrl,
  request,
}: {
  mode: PosterMode;
  localBackgroundUrl: string;
  request: () => Promise<PosterApiResult>;
}): Promise<ResolvedPosterBackground> {
  try {
    const result = await request();
    if (result.backgroundDataUrl) {
      return {
        backgroundUrl: result.backgroundDataUrl,
        effectiveMode:
          mode === 'creative' && !result.fallbackUsed
            ? 'creative'
            : 'faithful',
        fallbackUsed: Boolean(result.fallbackUsed),
        warning: result.warning || null,
        logoDataUrl: result.logoDataUrl || null,
      };
    }

    return {
      backgroundUrl: localBackgroundUrl,
      effectiveMode: 'faithful',
      fallbackUsed: Boolean(result.fallbackUsed),
      warning: result.warning || null,
      logoDataUrl: result.logoDataUrl || null,
    };
  } catch {
    return {
      backgroundUrl: localBackgroundUrl,
      effectiveMode: 'faithful',
      fallbackUsed: true,
      warning:
        'Sunucu yanıt vermedi; poster mevcut fotoğrafla yerel kanvasta hazırlandı.',
      logoDataUrl: null,
    };
  }
}
