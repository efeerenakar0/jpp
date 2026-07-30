import JSZip from 'jszip';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { fetchOwnedMediaBytes, normalizeMediaFileName } from '@/lib/media-storage';
import { PropertyMediaError } from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import { getOwnedStudioBatch } from '@/lib/studio-batches';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const bodySchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(20).optional(),
});
type Context = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { batchId } = await context.params;
    const parsed = bodySchema.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      throw new PropertyMediaError('ZIP seçimi geçersiz.');
    }
    const batch = await getOwnedStudioBatch(
      {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      batchId
    );
    const selectedIds = parsed.data.itemIds
      ? new Set(parsed.data.itemIds)
      : null;
    const items = batch.items.filter(
      (item) =>
        item.outputUrl &&
        item.outputFileName &&
        (item.status === 'COMPLETED' || item.status === 'ATTACHED') &&
        (!selectedIds || selectedIds.has(item.id))
    );
    if (!items.length) {
      throw new PropertyMediaError('ZIP için hazır görsel bulunamadı.');
    }
    if (selectedIds && items.length !== selectedIds.size) {
      throw new PropertyMediaError(
        'Seçilen sonuçlardan biri bu Stüdyo işlemine ait değil.',
        403
      );
    }
    const zip = new JSZip();
    let totalBytes = 0;
    for (const [index, item] of items.entries()) {
      const output = await fetchOwnedMediaBytes(item.outputUrl!);
      totalBytes += output.bytes.byteLength;
      if (totalBytes > 80 * 1024 * 1024) {
        throw new PropertyMediaError(
          'ZIP boyutu 80 MB sınırını aşıyor. Daha az görsel seçin.'
        );
      }
      zip.file(
        `${String(index + 1).padStart(2, '0')}-${normalizeMediaFileName(item.outputFileName!)}`,
        output.bytes
      );
    }
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('studio-sonuclari.zip')}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
