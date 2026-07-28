import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-100) || 'portfolio-image';
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Bir görsel dosyası seçin.' },
        { status: 400 }
      );
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yalnızca JPG, PNG, WebP veya AVIF yükleyebilirsiniz.',
        },
        { status: 400 }
      );
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'Görsel boyutu 15 MB veya daha küçük olmalıdır.',
        },
        { status: 400 }
      );
    }

    const blob = await put(
      `portfolio/${principal.account.id}/${safeFileName(image.name)}`,
      image,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: image.type,
      }
    );

    return NextResponse.json({
      success: true,
      url: blob.url,
      fileName: image.name,
      size: image.size,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Görsel yüklenemedi.',
      },
      { status: 500 }
    );
  }
}
