import JSZip from 'jszip';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { fetchOwnedMediaBytes, normalizeMediaFileName } from '@/lib/media-storage';
import { assertOwnedProperty, PropertyMediaError } from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const bodySchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1).max(20),
});
type Context = { params: Promise<{ propertyId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PropertyMediaError(
        'ZIP için 1 ile 20 arasında görsel seçin.'
      );
    }
    const actor = {
      companyAccountId: principal.account.id,
      memberId: principal.member?.id ?? null,
    };
    const property = await assertOwnedProperty(actor, propertyId);
    const ids = [...new Set(parsed.data.mediaIds)];
    const items = await prisma.crmPropertyMedia.findMany({
      where: {
        id: { in: ids },
        propertyId,
        companyAccountId: principal.account.id,
        archivedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (items.length !== ids.length) {
      throw new PropertyMediaError(
        'Seçilen görsellerden biri bu portföye ait değil.',
        403
      );
    }

    const zip = new JSZip();
    let totalBytes = 0;
    for (const [index, item] of items.entries()) {
      const downloaded = await fetchOwnedMediaBytes(item.url);
      totalBytes += downloaded.bytes.byteLength;
      if (totalBytes > 80 * 1024 * 1024) {
        throw new PropertyMediaError(
          'ZIP boyutu 80 MB sınırını aşıyor. Daha az görsel seçin.'
        );
      }
      zip.file(
        `${String(index + 1).padStart(2, '0')}-${normalizeMediaFileName(item.fileName)}`,
        downloaded.bytes
      );
    }
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    });
    const fileName = `${normalizeMediaFileName(property.title)}-gorseller.zip`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
