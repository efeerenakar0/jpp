import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/studio-store';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_PHOTO_BYTES = 9 * 1024 * 1024;
const MAX_PHOTOS = 12;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(request: Request) {
  try {
    await requireFabrikaPrincipal();
    const formData = await request.formData();

    const photoEntries: File[] = [];
    formData.forEach((value, key) => {
      if (
        value instanceof File &&
        (key === 'photos' ||
          key.startsWith('file_') ||
          key === 'file' ||
          key === 'photo')
      ) {
        photoEntries.push(value);
      }
    });

    if (!photoEntries.length) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_IMAGE',
          error: 'İyileştirmek için en az bir görsel yükleyin.',
        },
        { status: 400 }
      );
    }

    if (photoEntries.length > MAX_PHOTOS) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_IMAGE',
          error: `Tek işlemde en fazla ${MAX_PHOTOS} görsel yükleyebilirsiniz.`,
        },
        { status: 400 }
      );
    }

    const invalidPhoto = photoEntries.find(
      (file) =>
        file.size === 0 ||
        file.size > MAX_PHOTO_BYTES ||
        !SUPPORTED_IMAGE_TYPES.has(file.type)
    );
    if (invalidPhoto) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_IMAGE',
          error:
            'Görseller JPG, PNG veya WEBP biçiminde ve her biri 9 MB’den küçük olmalıdır.',
        },
        { status: 400 }
      );
    }

    const tempId = `shoot_${crypto.randomUUID()}`;
    const session = getOrCreateSession(tempId);
    session.device =
      String(formData.get('device') || '').slice(0, 80) || 'iPhone 15 Pro';
    session.websiteUrl =
      String(formData.get('websiteUrl') || '').slice(0, 300) ||
      'www.jasminegroup.com';
    session.textColor =
      String(formData.get('textColor') || '').slice(0, 20) || '#ffffff';

    const logoFile = formData.get('logo') || formData.get('logoFile');
    if (logoFile instanceof File && logoFile.size > 0) {
      if (
        logoFile.size > 2 * 1024 * 1024 ||
        !SUPPORTED_IMAGE_TYPES.has(logoFile.type)
      ) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_IMAGE',
            error:
              'Logo JPG, PNG veya WEBP biçiminde ve 2 MB’den küçük olmalıdır.',
          },
          { status: 400 }
        );
      }
      const logoBuf = Buffer.from(await logoFile.arrayBuffer());
      session.logoBase64 = logoBuf.toString('base64');
      session.logoMime = logoFile.type;
    }

    for (const [index, file] of photoEntries.entries()) {
      session.photos.push({
        name: file.name || `photo_${index + 1}.jpg`,
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
      });
    }

    return NextResponse.json({
      success: true,
      shootId: tempId,
      logoUrl: session.logoBase64 ? 'attached' : null,
      uploadedCount: session.photos.length,
      message: `${session.photos.length} adet fotoğraf stüdyoya başarıyla yüklendi.`,
    }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', error: error.message },
        { status: 401 }
      );
    }
    console.error('Studio Upload Error:', error);
    return NextResponse.json({
      success: false,
      code: 'UPLOAD_FAILED',
      error: 'Fotoğraflar yüklenemedi. Lütfen dosyaları kontrol edip yeniden deneyin.',
    }, { status: 500 });
  }
}
