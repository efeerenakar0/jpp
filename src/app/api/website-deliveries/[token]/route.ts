import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  createWebsiteDeliveryTokenHash,
  safeWebsiteArchiveName,
} from '@/lib/website-integration';
import { canCustomerAccessWebsiteDelivery } from '@/lib/website-delivery-state';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const now = new Date();
  const tokenHash = createWebsiteDeliveryTokenHash(token);
  const delivery = await prisma.websiteDeliveryToken.findUnique({
    where: { tokenHash },
    include: { websiteIntegration: true, version: true },
  });
  if (
    !delivery ||
    delivery.usedAt ||
    delivery.expiresAt.getTime() <= now.getTime() ||
    delivery.companyAccountId !== delivery.websiteIntegration.companyAccountId ||
    delivery.companyAccountId !== delivery.version.companyAccountId ||
    !canCustomerAccessWebsiteDelivery(delivery.websiteIntegration.status) ||
    delivery.version.qaStatus !== 'PASSED' ||
    !delivery.version.resultBlobPathname ||
    !delivery.version.resultFileName
  ) {
    return NextResponse.json({ error: 'Teslim bağlantısı geçersiz veya süresi dolmuş.' }, { status: 404 });
  }

  const blob = await get(delivery.version.resultBlobPathname, { access: 'private', useCache: false });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: 'Teslim paketi depoda bulunamadı.' }, { status: 404 });
  }
  const claimed = await prisma.websiteDeliveryToken.updateMany({
    where: { id: delivery.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: 'Teslim bağlantısı daha önce kullanılmış.' }, { status: 410 });
  }
  return new Response(blob.stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(blob.blob.size),
      'Content-Disposition': `attachment; filename="${safeWebsiteArchiveName(delivery.version.resultFileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Archive-SHA256': delivery.version.resultSha256 || '',
    },
  });
}
