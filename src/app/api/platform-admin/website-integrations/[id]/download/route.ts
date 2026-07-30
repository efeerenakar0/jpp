import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import { safeWebsiteArchiveName } from '@/lib/website-integration';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
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
    const integration = await prisma.websiteIntegration.findUnique({
      where: { id },
      select: {
        sourceBlobPathname: true,
        sourceFileName: true,
      },
    });
    if (!integration) {
      return NextResponse.json(
        { error: 'Site entegrasyonu bulunamadı.' },
        { status: 404 }
      );
    }

    const blob = await get(integration.sourceBlobPathname, {
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
          integration.sourceFileName
        )}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
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
