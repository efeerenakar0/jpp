const SUPPORTED_STUDIO_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_STUDIO_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_STUDIO_IMAGE_DIMENSION = 2048;

type ImageTransform = (file: File) => Promise<Blob>;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Görsel sıkıştırılamadı.')),
      'image/jpeg',
      quality
    );
  });
}

async function transformInBrowser(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_STUDIO_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Görsel yüzeyi hazırlanamadı.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let result = await canvasToBlob(canvas, 0.88);
    for (const quality of [0.76, 0.64, 0.52]) {
      if (result.size <= MAX_STUDIO_UPLOAD_BYTES) break;
      result = await canvasToBlob(canvas, quality);
    }
    return result;
  } finally {
    bitmap.close();
  }
}

export async function prepareStudioImageUpload(
  file: File,
  options: { transform?: ImageTransform } = {}
): Promise<File> {
  if (!SUPPORTED_STUDIO_IMAGE_TYPES.has(file.type)) {
    throw new Error('Görseller JPG, PNG veya WEBP biçiminde olmalıdır.');
  }
  if (file.size <= MAX_STUDIO_UPLOAD_BYTES) return file;

  const transformed = await (options.transform || transformInBrowser)(file);
  if (
    transformed.size === 0 ||
    transformed.size > MAX_STUDIO_UPLOAD_BYTES
  ) {
    throw new Error(
      'Görsel güvenli yükleme boyutuna indirilemedi. Daha küçük bir fotoğraf deneyin.'
    );
  }

  const baseName =
    file.name.replace(/\.[^/.]+$/, '').slice(0, 100) || 'studio_image';
  return new File([transformed], `${baseName}_studio.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}
