import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { safeWebsiteArchiveName } from '@/lib/website-integration';
import { canCustomerAccessWebsiteDelivery } from '@/lib/website-delivery-state';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const principal = await requireFabrikaOwner();
    const { id } = await context.params;
    const integration = await prisma.websiteIntegration.findFirst({
      where: { id, companyAccountId: principal.account.id },
      include: {
        versions: {
          where: { qaStatus: 'PASSED', resultBlobPathname: { not: null } },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!integration || !canCustomerAccessWebsiteDelivery(integration.status)) {
      return NextResponse.json({ error: 'Onaylı teslim paketi bulunamadı.' }, { status: 404 });
    }
    const version = integration.versions[0];
    if (!version?.resultBlobPathname || !version.resultFileName) {
      return NextResponse.json({ error: 'Onaylı teslim paketi bulunamadı.' }, { status: 404 });
    }
    const blob = await get(version.resultBlobPathname, { access: 'private', useCache: false });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'Teslim paketi depoda bulunamadı.' }, { status: 404 });
    }
    return new Response(blob.stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(blob.blob.size),
        'Content-Disposition': `attachment; filename="${safeWebsiteArchiveName(version.resultFileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Archive-SHA256': version.resultSha256 || '',
      },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: 'Fabrika oturumu gerekli.' }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: 'Bu işlem yalnız şirket sahibine açıktır.' }, { status: 403 });
    }
    console.error('[Website delivery download failed]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Teslim paketi indirilemedi.' }, { status: 500 });
  }
}
