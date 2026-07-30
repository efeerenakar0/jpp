import { NextResponse } from 'next/server';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

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

export async function POST(request: Request) {
  try {
    await requireFabrikaPrincipal();

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_REQUEST',
          error:
            'İyileştirme isteği okunamadı. Görseli yeniden seçip tekrar deneyin.',
        },
        { status: 400 }
      );
    }

    const photo = formData.get('photo');
    if (!(photo instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_IMAGE',
          error:
            'İşlenecek fotoğraf bulunamadı. Lütfen görseli yeniden seçin.',
        },
        { status: 400 }
      );
    }

    const promptValue = formData.get('prompt');
    const prompt =
      typeof promptValue === 'string' && promptValue.trim()
        ? promptValue.trim()
        : DEFAULT_STUDIO_ENHANCEMENT_PROMPT;
    if (prompt.length > 10_000) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PROMPT',
          error:
            'İyileştirme talimatı en fazla 10.000 karakter olabilir.',
        },
        { status: 400 }
      );
    }

    const processed = await enhanceWithStableImageUltra({
      image: Buffer.from(await photo.arrayBuffer()),
      mimeType: photo.type || imageMimeType(photo.name),
      prompt,
    });
    const outputName = `${safeBaseName(photo.name, 0)}_AI_iyilestirilmis.${processed.extension}`;

    return new Response(new Uint8Array(processed.buffer), {
      status: 200,
      headers: {
        'Content-Type': processed.mimeType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(outputName)}`,
        'X-Studio-File-Name': encodeURIComponent(outputName),
        'Cache-Control': 'private, no-store, max-age=0',
      },
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
