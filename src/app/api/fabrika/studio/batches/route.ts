import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import prisma from '@/lib/prisma';
import {
  createStudioBatch,
  studioBatchFingerprint,
} from '@/lib/studio-batches';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function parseMediaIds(formData: FormData) {
  const repeated = formData
    .getAll('mediaIds')
    .filter((value): value is string => typeof value === 'string');
  const encoded = formData.get('mediaIdsJson');
  if (typeof encoded !== 'string' || !encoded.trim()) return repeated;
  try {
    const parsed = JSON.parse(encoded);
    return Array.isArray(parsed)
      ? [...repeated, ...parsed.filter((id): id is string => typeof id === 'string')]
      : repeated;
  } catch {
    return repeated;
  }
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const batches = await prisma.studioBatch.findMany({
      where: {
        companyAccountId: principal.account.id,
        expiresAt: { gt: new Date() },
      },
      include: {
        property: { select: { id: true, title: true, location: true } },
        items: {
          select: {
            id: true,
            status: true,
            originalFileName: true,
            originalUrl: true,
            outputUrl: true,
            outputFileName: true,
            attachedMediaId: true,
            attemptCount: true,
            errorMessage: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const formData = await request.formData();
    const prompt =
      typeof formData.get('prompt') === 'string'
        ? String(formData.get('prompt'))
        : '';
    const propertyId =
      typeof formData.get('propertyId') === 'string'
        ? String(formData.get('propertyId')).trim() || null
        : null;
    const preset =
      typeof formData.get('preset') === 'string'
        ? String(formData.get('preset'))
        : null;
    const files = formData
      .getAll('photos')
      .filter((value): value is File => value instanceof File);
    const mediaIds = parseMediaIds(formData);
    const idempotencyKey =
      request.headers.get('idempotency-key') ||
      studioBatchFingerprint({ propertyId, mediaIds, files, prompt });
    const batch = await createStudioBatch({
      actor: {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      propertyId,
      mediaIds,
      files,
      prompt,
      preset,
      idempotencyKey,
    });
    return NextResponse.json({ success: true, batch }, { status: 201 });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
