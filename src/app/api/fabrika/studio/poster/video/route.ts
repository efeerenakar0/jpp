import { createHash } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';
import { BannerbearVideoError } from '@/lib/bannerbear-video';
import { processNextBannerbearPosterVideoJob } from '@/lib/bannerbear-poster-video-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const requestSchema = z.object({
  propertyId: z.string().trim().min(1).max(120),
  mediaIds: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
  format: z.enum(['post', 'story']).default('story'),
  transition: z.enum(['none', 'fade', 'dissolve', 'wipeleft', 'slideleft']).default('fade'),
  slideDuration: z.number().min(2).max(5).default(3),
});

function artifactUrl(jobId: string) {
  return `/api/fabrika/studio/video/jobs/${encodeURIComponent(jobId)}/artifact`;
}

export async function POST(request: Request) {
  let createdJobId: string | null = null;
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Video için bir portföy ve 2–8 fotoğraf seçin.' },
        { status: 400 }
      );
    }
    const uniqueMediaIds = Array.from(new Set(parsed.data.mediaIds));
    if (uniqueMediaIds.length < 2) {
      return NextResponse.json(
        { error: 'Video için en az iki farklı fotoğraf seçin.' },
        { status: 400 }
      );
    }
    const property = await prisma.crmProperty.findFirst({
      where: {
        id: parsed.data.propertyId,
        companyAccountId: principal.account.id,
      },
      select: { id: true, title: true },
    });
    if (!property) {
      return NextResponse.json({ error: 'Portföy bulunamadı.' }, { status: 404 });
    }
    const media = await prisma.crmPropertyMedia.findMany({
      where: {
        id: { in: uniqueMediaIds },
        companyAccountId: principal.account.id,
        propertyId: property.id,
        archivedAt: null,
        mediaType: 'PHOTO',
        usageRightsStatus: { not: 'RESTRICTED' },
      },
      select: { id: true, url: true, fileName: true },
    });
    const byId = new Map(media.map((item) => [item.id, item]));
    const orderedMedia = uniqueMediaIds
      .map((id) => byId.get(id))
      .filter((item): item is (typeof media)[number] => Boolean(item));
    if (orderedMedia.length !== uniqueMediaIds.length) {
      return NextResponse.json(
        { error: 'Seçilen fotoğraflardan biri bu portföye ait değil.' },
        { status: 403 }
      );
    }

    const idempotencyKey = createHash('sha256')
      .update(JSON.stringify({
        companyAccountId: principal.account.id,
        propertyId: property.id,
        mediaIds: uniqueMediaIds,
        format: parsed.data.format,
        transition: parsed.data.transition,
        slideDuration: parsed.data.slideDuration,
        renderer: 'bannerbear-v5-slideshow',
      }))
      .digest('hex');
    const existing = await prisma.studioVideoJob.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: principal.account.id,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.status === 'COMPLETED' && existing.outputStorageKey) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          jobId: existing.id,
          videoUrl: artifactUrl(existing.id),
          durationSeconds: existing.durationSeconds,
          photoCount: orderedMedia.length,
        });
      }
      if (['QUEUED', 'SUBMITTING', 'GENERATING', 'PERSISTING'].includes(existing.status)) {
        after(() => processNextBannerbearPosterVideoJob({ jobId: existing.id }));
        return NextResponse.json({
          success: true,
          pending: true,
          idempotent: true,
          jobId: existing.id,
          progress: existing.progress,
          durationSeconds: existing.durationSeconds,
          photoCount: orderedMedia.length,
        }, { status: 202 });
      }
      return NextResponse.json(
        {
          error: 'Bu video denemesi tamamlanamadı. Geçişi veya fotoğraf sırasını değiştirip yeniden deneyin.',
        },
        { status: 409 }
      );
    }

    const durationSeconds = orderedMedia.length * parsed.data.slideDuration;
    const job = await prisma.studioVideoJob.create({
      data: {
        companyAccountId: principal.account.id,
        propertyId: property.id,
        createdByMemberId: principal.member?.id ?? null,
        prompt: 'Gerçek portföy fotoğraflarından Bannerbear slayt videosu',
        userCommand: `${orderedMedia.length} fotoğraf · ${parsed.data.transition} geçiş`,
        referenceMediaIds: orderedMedia.map((item) => item.id),
        referenceSnapshot: orderedMedia.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          url: item.url,
        })),
        provider: 'BANNERBEAR',
        model: 'bannerbear-v5-create-video-slideshow',
        durationSeconds,
        ratio: parsed.data.format === 'story' ? '9:16' : '4:5',
        resolution: '1080p',
        generateAudio: false,
        status: 'QUEUED',
        progress: 8,
        idempotencyKey,
      },
    });
    createdJobId = job.id;
    after(() => processNextBannerbearPosterVideoJob({ jobId: job.id }));
    return NextResponse.json({
      success: true,
      pending: true,
      jobId: job.id,
      progress: job.progress,
      durationSeconds,
      photoCount: orderedMedia.length,
    }, { status: 202 });
  } catch (error) {
    if (createdJobId) {
      await prisma.studioVideoJob.updateMany({
        where: { id: createdJobId, status: { not: 'COMPLETED' } },
        data: {
          status: 'FAILED',
          progress: 100,
          errorCode: error instanceof BannerbearVideoError ? error.code : 'VIDEO_RENDER_FAILED',
          errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : 'Video hazırlanamadı.',
        },
      }).catch(() => undefined);
    }
    if (error instanceof BannerbearVideoError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'INVALID_INPUT' ? 400 : 503 }
      );
    }
    return NextResponse.json(
      { error: 'Portföy videosu şu anda hazırlanamadı.' },
      { status: 500 }
    );
  }
}
