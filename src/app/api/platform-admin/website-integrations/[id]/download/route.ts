import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import { safeWebsiteArchiveName } from '@/lib/website-integration';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: RouteContext<
    '/api/platform-admin/website-integrations/[id]/download'
  >
) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json(
      { error: 'Platform yöneticisi oturumu gerekli.' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const requestedVersion = Number(new URL(request.url).searchParams.get('version'));
    const integration = await prisma.websiteIntegration.findUnique({
      where: { id },
      select: {
        sourceBlobPathname: true,
        sourceFileName: true,
        versions: {
          where: Number.isInteger(requestedVersion) && requestedVersion > 0 ? { version: requestedVersion } : undefined,
          orderBy: { version: 'desc' },
          take: 1,
          select: { sourceBlobPathname: true, sourceFileName: true, sourceSha256: true },
        },
      },
    });
    if (!integration) {
      return NextResponse.json(
        { error: 'Site entegrasyonu bulunamadı.' },
        { status: 404 }
      );
    }

    const source = integration.versions[0] || integration;
    const blob = await get(source.sourceBlobPathname, {
      access: 'private',
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json(
        { error: 'Kaynak kodu paketi bulunamadı.' },
        { status: 404 }
      );
    }

    return new Response(blob.stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(blob.blob.size),
        'Content-Disposition': `attachment; filename="${safeWebsiteArchiveName(
          source.sourceFileName
        )}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        ...('sourceSha256' in source && source.sourceSha256
          ? { 'X-Archive-SHA256': source.sourceSha256 }
          : {}),
      },
    });
  } catch (error) {
    console.error('[Website source download error]', error);
    return NextResponse.json(
      { error: 'Kaynak kodu paketi indirilemedi.' },
      { status: 500 }
    );
  }
}
