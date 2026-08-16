import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import prisma from '@/lib/prisma';
import {
  createStudioBatch,
  studioBatchFingerprint,
} from '@/lib/studio-batches';
import { STUDIO_MAX_PHOTOS } from '@/lib/studio-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const uploadedFileSchema = z.object({
  url: z.string().url().max(2_000),
  pathname: z.string().min(1).max(500),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(100),
  byteSize: z.number().int().positive(),
});

const batchJsonSchema = z.object({
  prompt: z.string().min(1).max(10_000),
  propertyId: z.string().trim().min(1).max(160).nullable().optional(),
  preset: z.string().trim().max(100).nullable().optional(),
  title: z.string().trim().max(180).nullable().optional(),
  mediaIds: z.array(z.string().trim().min(1).max(160)).max(STUDIO_MAX_PHOTOS).default([]),
  uploadedFiles: z.array(uploadedFileSchema).max(STUDIO_MAX_PHOTOS).default([]),
});

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
            title: true,
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
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = batchJsonSchema.parse(await request.json());
      const idempotencyKey =
        request.headers.get('idempotency-key') ||
        studioBatchFingerprint({
          propertyId: body.propertyId,
          mediaIds: body.mediaIds,
          files: [],
          uploadedFiles: body.uploadedFiles,
          prompt: body.prompt,
        });
      const batch = await createStudioBatch({
        actor: {
          companyAccountId: principal.account.id,
          memberId: principal.member?.id ?? null,
        },
        propertyId: body.propertyId,
        mediaIds: body.mediaIds,
        uploadedFiles: body.uploadedFiles,
        prompt: body.prompt,
        preset: body.preset,
        title: body.title,
        idempotencyKey,
      });
      return NextResponse.json({ success: true, batch }, { status: 201 });
    }
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
    const title =
      typeof formData.get('title') === 'string'
        ? String(formData.get('title')).trim().slice(0, 180) || null
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
      title,
      idempotencyKey,
    });
    return NextResponse.json({ success: true, batch }, { status: 201 });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
