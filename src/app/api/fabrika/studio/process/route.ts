import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateSession } from '@/lib/studio-store';
import { getCompanyStudioCredential } from '@/lib/company-ai-credentials';
import {
  FABRIKA_SESSION_COOKIE,
  readFabrikaSessionToken,
} from '@/lib/fabrika-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const STUDIO_ENHANCEMENT_PROMPT =
  'Bu resimler portföyümün sitesinde yayınlanacak. Her birini yapay zeka ile muhteşem hale getir; ışıklandırmayı, renkleri, netliği ve genel kaliteyi profesyonel emlak fotoğrafçılığı standardında iyileştir. Mimariyi, mobilyaları, perspektifi ve mülkün gerçek özelliklerini koru; yeni nesneler, kişiler, yazılar veya logolar ekleme.';

function imageMimeType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

type ProcessedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

class StudioProviderError extends Error {
  constructor(
    readonly provider: 'OPENAI' | 'GEMINI',
    readonly status: number,
    readonly providerMessage: string
  ) {
    super(providerMessage);
    this.name = 'StudioProviderError';
  }
}

function studioErrorResponse(error: unknown) {
  if (!(error instanceof StudioProviderError)) {
    return {
      status: 500,
      message: error instanceof Error ? error.message : 'Görseller işlenemedi.',
    };
  }

  const normalized = error.providerMessage.toLowerCase();
  const quotaExceeded =
    error.status === 429 ||
    normalized.includes('quota') ||
    normalized.includes('billing');
  const unauthorized =
    error.status === 401 ||
    error.status === 403 ||
    normalized.includes('api key not valid') ||
    normalized.includes('invalid api key');

  if (error.provider === 'GEMINI' && quotaExceeded) {
    return {
      status: 429,
      message:
        'Gemini görsel oluşturma ücretsiz pakette kullanılamıyor. Google AI Studio’da bu API anahtarının bağlı olduğu proje için Billing bölümünden ücretli kullanımı açın, ardından tekrar deneyin.',
    };
  }

  if (error.provider === 'OPENAI' && quotaExceeded) {
    return {
      status: 429,
      message:
        'OpenAI hesabınızın görsel oluşturma bakiyesi veya kullanım limiti yetersiz. OpenAI Platform Billing bölümünü kontrol edip tekrar deneyin.',
    };
  }

  if (unauthorized) {
    return {
      status: 401,
      message: `${error.provider === 'GEMINI' ? 'Gemini' : 'OpenAI'} API anahtarı geçersiz veya bu projede yetkili değil. Stüdyo API ayarlarından anahtarı kontrol edin.`,
    };
  }

  return {
    status: 502,
    message: `${
      error.provider === 'GEMINI' ? 'Gemini' : 'OpenAI'
    } görsel servisi isteği tamamlayamadı. API ayarlarınızı ve seçilen modeli kontrol edip tekrar deneyin.`,
  };
}

async function enhanceWithOpenAI(
  photo: { name: string; buffer: Buffer },
  apiKey: string,
  model: string
): Promise<ProcessedImage> {
  const body = new FormData();
  body.append(
    'image',
    new Blob([new Uint8Array(photo.buffer)], { type: imageMimeType(photo.name) }),
    photo.name
  );
  body.append('prompt', STUDIO_ENHANCEMENT_PROMPT);
  body.append('model', model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  body.append('quality', 'high');
  body.append('output_format', 'jpeg');
  body.append('output_compression', '92');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  } | null;

  const image = payload?.data?.[0]?.b64_json;
  if (!response.ok || !image) {
    throw new StudioProviderError(
      'OPENAI',
      response.status,
      payload?.error?.message || 'OpenAI görsel düzenleme yanıtı alınamadı.'
    );
  }
  return { buffer: Buffer.from(image, 'base64'), mimeType: 'image/jpeg', extension: 'jpg' };
}

async function enhanceWithGemini(
  photo: { name: string; buffer: Buffer },
  apiKey: string,
  model: string
): Promise<ProcessedImage> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: STUDIO_ENHANCEMENT_PROMPT },
              {
                inline_data: {
                  mime_type: imageMimeType(photo.name),
                  data: photo.buffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      cache: 'no-store',
    }
  );
  const payload = (await response.json().catch(() => null)) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
    error?: { message?: string };
  } | null;
  const image = payload?.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data
  )?.inlineData;

  if (!response.ok || !image?.data) {
    throw new StudioProviderError(
      'GEMINI',
      response.status,
      payload?.error?.message || 'Gemini görsel düzenleme yanıtı alınamadı.'
    );
  }

  const mimeType = image.mimeType || 'image/png';
  return {
    buffer: Buffer.from(image.data, 'base64'),
    mimeType,
    extension: mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png',
  };
}

async function configuredStudioProvider() {
  const cookieStore = await cookies();
  const session = readFabrikaSessionToken(
    cookieStore.get(FABRIKA_SESSION_COOKIE)?.value
  );
  if (!session) throw new Error('Fabrika oturumu gerekli.');

  const companyCredential = await getCompanyStudioCredential(session.accountId);
  if (companyCredential) return companyCredential;

  const fallbackApiKey = process.env.OPENAI_API_KEY;
  if (fallbackApiKey) {
    return {
      provider: 'OPENAI' as const,
      apiKey: fallbackApiKey,
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    };
  }

  throw new Error('Stüdyo AI ayarlarından Gemini veya OpenAI API anahtarınızı ekleyin.');
}

export async function POST(request: Request) {
  try {
    const { shootId } = await request.json().catch(() => ({}));
    const safeShootId = shootId || `shoot_${Date.now()}`;
    const session = getOrCreateSession(safeShootId);

    if (session.photos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'İşlenecek fotoğraf bulunamadı.' },
        { status: 400 }
      );
    }

    const provider = await configuredStudioProvider();
    session.aiPhotos = [];
    session.aiProvider = provider.provider;
    session.aiModel = provider.model;
    for (const photo of session.photos) {
      const processed = provider.provider === 'GEMINI'
        ? await enhanceWithGemini(photo, provider.apiKey, provider.model)
        : await enhanceWithOpenAI(photo, provider.apiKey, provider.model);
      const baseName = photo.name.replace(/\.[^/.]+$/, '');
      session.aiPhotos.push({
        name: `${baseName}_AI_iyilestirilmis.${processed.extension}`,
        buffer: processed.buffer,
        mimeType: processed.mimeType,
      });
    }

    return NextResponse.json({
      success: true,
      prompt: STUDIO_ENHANCEMENT_PROMPT,
      processedCount: session.aiPhotos.length,
      results: session.aiPhotos.map((photo, index) => ({
        name: photo.name,
        previewUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(safeShootId)}&format=single&index=${index}`,
        downloadUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(safeShootId)}&format=single&index=${index}&download=true`,
      })),
      zipUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(safeShootId)}&format=zip`,
    });
  } catch (error: unknown) {
    console.error('Studio Process Error:', error);
    const responseError = studioErrorResponse(error);
    return NextResponse.json(
      { success: false, error: responseError.message },
      { status: responseError.status }
    );
  }
}
