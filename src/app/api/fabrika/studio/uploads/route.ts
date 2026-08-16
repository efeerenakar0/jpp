import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  STUDIO_IMAGE_TYPES,
  STUDIO_MAX_FILE_BYTES,
  studioUploadAccountPrefix,
} from '@/lib/studio-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    return NextResponse.json({
      success: true,
      prefix: `${studioUploadAccountPrefix(principal.account.id)}/${crypto.randomUUID()}`,
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Fotoğraf yükleme alanı hazırlanamadı.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const accountPrefix = `${studioUploadAccountPrefix(principal.account.id)}/`;
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(accountPrefix) || pathname.includes('..')) {
          throw new Error('Geçersiz stüdyo yükleme yolu.');
        }
        return {
          allowedContentTypes: [...STUDIO_IMAGE_TYPES],
          maximumSizeInBytes: STUDIO_MAX_FILE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fotoğraf yüklenemedi.',
      },
      { status: 400 }
    );
  }
}
