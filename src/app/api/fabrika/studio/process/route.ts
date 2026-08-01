import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
} from '@/lib/studio-enhancement';
import {
  StabilityUltraError,
  enhanceWithStableImageUltra,
} from '@/lib/stability-ultra';
import { getOrCreateSession } from '@/lib/studio-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const MAX_DIRECT_IMAGE_BYTES = 9 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const processRequestSchema = z.object({
  shootId: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(10_000).optional(),
});

function imageMimeType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function safeBaseName(name: string, index: number) {
  const withoutExtension = name.replace(/\.[^/.]+$/, '');
  const normalized = withoutExtension
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return normalized || `gorsel_${index + 1}`;
}

async function processDirectUpload(request: Request) {
  const form = await request.formData();
  const photo = form.get('photo');
  const promptValue = form.get('prompt');
  const prompt =
    typeof promptValue === 'string' && promptValue.trim()
      ? promptValue.trim()
      : DEFAULT_STUDIO_ENHANCEMENT_PROMPT;

  if (
    !(photo instanceof File) ||
    photo.size === 0 ||
    photo.size > MAX_DIRECT_IMAGE_BYTES ||
    !SUPPORTED_IMAGE_TYPES.has(photo.type) ||
    prompt.length > 10_000
  ) {
    return NextResponse.json(
      {
        success: false,
        code: 'INVALID_IMAGE',
        error:
          'Görsel JPG, PNG veya WEBP olmalı, 9 MB altında kalmalı ve talimat 10.000 karakteri geçmemelidir.',
      },
      { status: 400 }
    );
  }

  const processed = await enhanceWithStableImageUltra({
    image: Buffer.from(await photo.arrayBuffer()),
    mimeType: photo.type,
    prompt,
  });
  const resultName = `${safeBaseName(photo.name, 0)}_AI_yeniden_olusturuldu.${processed.extension}`;

  return new Response(new Uint8Array(processed.buffer), {
    status: 200,
    headers: {
      'Content-Type': processed.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(resultName)}`,
      'Cache-Control': 'no-store',
      'X-Studio-Filename': encodeURIComponent(resultName),
      'X-Studio-Provider': 'Stable Image Ultra',
    },
  });
}

export async function POST(request: Request) {
  try {
    await requireFabrikaPrincipal();

    if (
      request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('multipart/form-data')
    ) {
      return await processDirectUpload(request);
    }

    const payload = processRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!payload.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          error:
            'İyileştirme isteği geçersiz. Görselleri yeniden yükleyip talimatı kontrol edin.',
        },
        { status: 400 }
      );
    }

    const { shootId } = payload.data;
    const prompt =
      payload.data.prompt || DEFAULT_STUDIO_ENHANCEMENT_PROMPT;
    const session = getOrCreateSession(shootId);

    if (session.photos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_IMAGE',
          error:
            'İşlenecek fotoğraf bulunamadı. Lütfen görselleri yeniden yükleyin.',
        },
        { status: 400 }
      );
    }

    session.aiPhotos = [];
    session.aiProvider = 'STABILITY';
    session.aiModel = 'Stable Image Ultra';

    for (const [index, photo] of session.photos.entries()) {
      const processed = await enhanceWithStableImageUltra({
        image: photo.buffer,
        mimeType: photo.mimeType || imageMimeType(photo.name),
        prompt,
      });
      session.aiPhotos.push({
        name: `${safeBaseName(photo.name, index)}_AI_iyilestirilmis.${processed.extension}`,
        buffer: processed.buffer,
        mimeType: processed.mimeType,
      });
    }

    return NextResponse.json({
      success: true,
      prompt,
      provider: 'Stable Image Ultra',
      processedCount: session.aiPhotos.length,
      results: session.aiPhotos.map((photo, index) => ({
        name: photo.name,
        previewUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(shootId)}&format=single&index=${index}`,
        downloadUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(shootId)}&format=single&index=${index}&download=true`,
      })),
      zipUrl: `/api/fabrika/studio/download?shootId=${encodeURIComponent(shootId)}&format=zip`,
    });
  } catch (error: unknown) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          error: error.message,
        },
        { status: 401 }
      );
    }

    if (error instanceof StabilityUltraError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
        },
        { status: error.status }
      );
    }

    console.error('Studio Process Error:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'PROCESSING_FAILED',
        error:
          'Görseller işlenirken beklenmeyen bir sorun oluştu. Lütfen kısa bir süre sonra yeniden deneyin.',
      },
      { status: 500 }
    );
  }
}
