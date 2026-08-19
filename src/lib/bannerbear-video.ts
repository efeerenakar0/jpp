import 'server-only';

const BANNERBEAR_API = 'https://api.bannerbear.com/v5';
const VIDEO_TIMEOUT_MS = 180_000;

export type BannerbearVideoTransition =
  | 'none'
  | 'fade'
  | 'dissolve'
  | 'wipeleft'
  | 'slideleft';

export type BannerbearToolJob = {
  uid?: string;
  tool?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  outputs?: { video_url?: string | null };
  error_message?: string | null;
};

export class BannerbearVideoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_CONFIGURED'
      | 'INVALID_INPUT'
      | 'PERMISSION_DENIED'
      | 'QUOTA_EXHAUSTED'
      | 'PROVIDER_ERROR'
      | 'PROVIDER_TIMEOUT'
      | 'INVALID_PROVIDER_RESPONSE',
    public readonly status = 502
  ) {
    super(message);
    this.name = 'BannerbearVideoError';
  }
}

type BannerbearVideoDependencies = {
  fetcher?: typeof fetch;
  sleeper?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

type WaitForBannerbearSlideshowInput = {
  apiKey?: string | null;
  providerRequestId: string;
  photoCount: number;
  slideDuration: number;
  onProgress?: (progress: number, status: 'pending' | 'running') => Promise<void> | void;
};

export type BannerbearSlideshowStatus =
  | { status: 'PENDING' | 'RUNNING'; progress: number }
  | { status: 'COMPLETED'; progress: 100; videoUrl: string }
  | { status: 'FAILED'; progress: 100; errorMessage: string };

function cleanMetadata(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

async function request<T>(
  path: string,
  apiKey: string,
  init: RequestInit,
  fetcher: typeof fetch
) {
  const response = await fetcher(`${BANNERBEAR_API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (response.ok && payload) return payload;
  if (response.status === 401 || response.status === 403) {
    throw new BannerbearVideoError(
      'Bannerbear API anahtarında video araçları yetkisi bulunmuyor.',
      'PERMISSION_DENIED',
      response.status
    );
  }
  if (response.status === 402) {
    throw new BannerbearVideoError(
      'Bannerbear video kotası doldu.',
      'QUOTA_EXHAUSTED',
      402
    );
  }
  throw new BannerbearVideoError(
    `Bannerbear video isteği tamamlanamadı (${response.status}).`,
    'PROVIDER_ERROR',
    response.status || 502
  );
}

export async function submitBannerbearSlideshow(
  input: {
    apiKey?: string | null;
    imageUrls: string[];
    format: 'post' | 'story';
    slideDuration: number;
    transition: BannerbearVideoTransition;
    transitionDuration?: number;
    metadata: string;
    onSubmitted?: (providerRequestId: string) => Promise<void> | void;
  },
  dependencies: BannerbearVideoDependencies = {}
) {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    throw new BannerbearVideoError(
      'Bannerbear sunucu bağlantısı yapılandırılmamış.',
      'NOT_CONFIGURED',
      503
    );
  }
  const imageUrls = Array.from(new Set(input.imageUrls.map((url) => url.trim()).filter(Boolean)));
  if (imageUrls.length < 2 || imageUrls.length > 8) {
    throw new BannerbearVideoError(
      'Video için 2 ile 8 arasında portföy fotoğrafı seçilmelidir.',
      'INVALID_INPUT',
      400
    );
  }
  for (const value of imageUrls) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BannerbearVideoError('Video fotoğraf adresi geçersiz.', 'INVALID_INPUT', 400);
    }
    if (url.protocol !== 'https:') {
      throw new BannerbearVideoError('Video fotoğrafları güvenli HTTPS adresinde olmalıdır.', 'INVALID_INPUT', 400);
    }
  }

  const fetcher = dependencies.fetcher ?? fetch;
  const dimensions = input.format === 'story'
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1350 };
  const created = await request<BannerbearToolJob>(
    '/tools/create_video_slideshow',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        image_urls: imageUrls,
        slide_duration: Math.min(5, Math.max(2, input.slideDuration)),
        transition: input.transition,
        transition_duration: Math.min(1.5, Math.max(0.3, input.transitionDuration ?? 0.8)),
        ...dimensions,
        metadata: cleanMetadata(input.metadata),
      }),
    },
    fetcher
  );
  if (!created.uid) {
    throw new BannerbearVideoError(
      'Bannerbear video görev kimliği döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  await input.onSubmitted?.(created.uid);

  return { providerRequestId: created.uid };
}

export async function getBannerbearSlideshowStatus(
  input: { apiKey?: string | null; providerRequestId: string },
  dependencies: BannerbearVideoDependencies = {}
): Promise<BannerbearSlideshowStatus> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    throw new BannerbearVideoError(
      'Bannerbear sunucu bağlantısı yapılandırılmamış.',
      'NOT_CONFIGURED',
      503
    );
  }
  const providerRequestId = input.providerRequestId.trim();
  if (!providerRequestId) {
    throw new BannerbearVideoError(
      'Bannerbear video görev kimliği eksik.',
      'INVALID_INPUT',
      400
    );
  }
  const job = await request<BannerbearToolJob>(
    `/tool_jobs/${encodeURIComponent(providerRequestId)}`,
    apiKey,
    { method: 'GET' },
    dependencies.fetcher ?? fetch
  );
  if (job.uid !== providerRequestId || job.tool !== 'create_video_slideshow') {
    throw new BannerbearVideoError(
      'Bannerbear beklenen video görevini döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  if (job.status === 'completed') {
    const videoUrl = job.outputs?.video_url?.trim();
    if (!videoUrl || !videoUrl.startsWith('https://')) {
      throw new BannerbearVideoError(
        'Bannerbear tamamlanan video adresini döndürmedi.',
        'INVALID_PROVIDER_RESPONSE'
      );
    }
    return { status: 'COMPLETED', progress: 100, videoUrl };
  }
  if (job.status === 'failed') {
    return {
      status: 'FAILED',
      progress: 100,
      errorMessage: job.error_message?.slice(0, 240) || 'Bannerbear videoyu hazırlayamadı.',
    };
  }
  return {
    status: job.status === 'running' ? 'RUNNING' : 'PENDING',
    progress: Math.min(99, Math.max(5, Number(job.progress) || 5)),
  };
}

export async function generateBannerbearSlideshow(
  input: {
    apiKey?: string | null;
    imageUrls: string[];
    format: 'post' | 'story';
    slideDuration: number;
    transition: BannerbearVideoTransition;
    transitionDuration?: number;
    metadata: string;
    onSubmitted?: (providerRequestId: string) => Promise<void> | void;
    onProgress?: (progress: number, status: 'pending' | 'running') => Promise<void> | void;
  },
  dependencies: BannerbearVideoDependencies = {}
) {
  const submitted = await submitBannerbearSlideshow(input, dependencies);

  return waitForBannerbearSlideshow(
    {
      apiKey: input.apiKey,
      providerRequestId: submitted.providerRequestId,
      photoCount: Array.from(new Set(input.imageUrls.map((url) => url.trim()).filter(Boolean))).length,
      slideDuration: input.slideDuration,
      onProgress: input.onProgress,
    },
    dependencies
  );
}

export async function waitForBannerbearSlideshow(
  input: WaitForBannerbearSlideshowInput,
  dependencies: BannerbearVideoDependencies = {}
) {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    throw new BannerbearVideoError(
      'Bannerbear sunucu bağlantısı yapılandırılmamış.',
      'NOT_CONFIGURED',
      503
    );
  }
  const providerRequestId = input.providerRequestId.trim();
  if (!providerRequestId) {
    throw new BannerbearVideoError(
      'Bannerbear video görev kimliği eksik.',
      'INVALID_INPUT',
      400
    );
  }
  const fetcher = dependencies.fetcher ?? fetch;
  const sleeper = dependencies.sleeper ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = dependencies.now ?? Date.now;

  const startedAt = now();
  let lastProgress = -1;
  while (now() - startedAt < VIDEO_TIMEOUT_MS) {
    const job = await getBannerbearSlideshowStatus(
      { apiKey, providerRequestId },
      { ...dependencies, fetcher }
    );
    if (job.status === 'COMPLETED') {
      return {
        videoUrl: job.videoUrl,
        providerRequestId,
        durationSeconds: input.photoCount * Math.min(5, Math.max(2, input.slideDuration)),
      };
    }
    if (job.status === 'FAILED') {
      throw new BannerbearVideoError(
        job.errorMessage,
        'PROVIDER_ERROR'
      );
    }
    if (job.progress !== lastProgress) {
      lastProgress = job.progress;
      await input.onProgress?.(job.progress, job.status === 'RUNNING' ? 'running' : 'pending');
    }
    await sleeper(1_000);
  }
  throw new BannerbearVideoError(
    'Bannerbear video hazırlama süresi aşıldı.',
    'PROVIDER_TIMEOUT',
    504
  );
}
