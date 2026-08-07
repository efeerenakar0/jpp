import 'server-only';

import type { Prisma, PrismaClient, StudioVideoJob, StudioVideoJobStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { portfolioVideoStoryboardSchema, type PortfolioVideoStoryboard } from '@/lib/portfolio-video/types';
import { StudioVideoJobError, type StudioVideoActor } from './jobs';

const BROWSER_PROVIDER = 'BROWSER_REMOTION';
const BROWSER_MODEL = 'PortfolioPromoVideo:web-renderer';

type BrowserVideoClient = Pick<PrismaClient, 'crmProperty' | 'studioVideoJob'>;

export type BrowserRemotionStage =
  | 'CHECKING'
  | 'RENDERING'
  | 'ENCODING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRY';

type BrowserSnapshot = {
  media: Array<{ id: string; url: string; fileName: string; isCover: boolean }>;
  storyboard: PortfolioVideoStoryboard;
  fingerprint: string;
  seed: number;
};

function ownedWhere(actor: StudioVideoActor) {
  return {
    companyAccountId: actor.companyAccountId,
    ...(actor.memberId ? { createdByMemberId: actor.memberId } : {}),
    provider: BROWSER_PROVIDER,
  };
}

function asSnapshot(value: Prisma.JsonValue): BrowserSnapshot | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const storyboard = portfolioVideoStoryboardSchema.safeParse(record.storyboard);
  if (!storyboard.success || typeof record.fingerprint !== 'string' || typeof record.seed !== 'number') {
    return null;
  }
  const media = Array.isArray(record.media)
    ? record.media.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const entry = item as Record<string, unknown>;
        if (typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.fileName !== 'string') return [];
        return [{ id: entry.id, url: entry.url, fileName: entry.fileName, isCover: Boolean(entry.isCover) }];
      })
    : [];
  return { media, storyboard: storyboard.data, fingerprint: record.fingerprint, seed: record.seed };
}

export function serializeBrowserRemotionJob(job: StudioVideoJob) {
  const snapshot = asSnapshot(job.referenceSnapshot);
  return {
    id: job.id,
    propertyId: job.propertyId,
    title: job.outputFileName || snapshot?.storyboard.title || 'Portföy videosu',
    command: job.userCommand,
    status: job.status,
    progress: job.progress,
    fingerprint: snapshot?.fingerprint || null,
    seed: snapshot?.seed ?? null,
    storyboard: snapshot?.storyboard ?? null,
    selectedPhotoIds: job.referenceMediaIds,
    previewUrl: snapshot?.media[0]?.url || null,
    outputFileName: job.outputFileName,
    outputMimeType: job.outputMimeType,
    outputByteSize: job.outputByteSize,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    deviceOnly: true,
    artifactHref: null,
  };
}

export async function createBrowserRemotionJob(
  input: {
    actor: StudioVideoActor;
    propertyId: string;
    mediaIds: string[];
    command: string;
    storyboard: unknown;
    fingerprint: string;
    seed: number;
    idempotencyKey: string;
    now?: Date;
  },
  client: BrowserVideoClient = prisma,
) {
  const command = input.command.replace(/\s+/g, ' ').trim();
  const storyboard = portfolioVideoStoryboardSchema.parse(input.storyboard);
  const mediaIds = [...new Set(input.mediaIds.map((value) => value.trim()).filter(Boolean))];
  const fingerprint = input.fingerprint.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (command.length < 3 || command.length > 1_000 || !fingerprint || fingerprint.length > 80 || !idempotencyKey || idempotencyKey.length > 200) {
    throw new StudioVideoJobError('Tarayıcı video işi bilgileri geçersiz.');
  }
  if (!mediaIds.length || mediaIds.length > 8) {
    throw new StudioVideoJobError('Video için 1 ile 8 portföy fotoğrafı seçin.');
  }

  const existing = await client.studioVideoJob.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.actor.companyAccountId,
        idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.provider !== BROWSER_PROVIDER || existing.propertyId !== input.propertyId) {
      throw new StudioVideoJobError('Bu video iş anahtarı başka bir işlemde kullanılıyor.', 409, 'IDEMPOTENCY_CONFLICT');
    }
    return existing;
  }

  const property = await client.crmProperty.findFirst({
    where: {
      id: input.propertyId,
      companyAccountId: input.actor.companyAccountId,
      status: { in: ['DRAFT', 'ACTIVE', 'RESERVED'] },
    },
    include: {
      media: {
        where: {
          id: { in: mediaIds },
          companyAccountId: input.actor.companyAccountId,
          archivedAt: null,
          mediaType: 'PHOTO',
          usageRightsStatus: { not: 'RESTRICTED' },
        },
        select: { id: true, url: true, fileName: true, isCover: true },
      },
    },
  });
  if (!property) {
    throw new StudioVideoJobError('Portföy bulunamadı veya bu şirkete ait değil.', 404, 'PROPERTY_NOT_FOUND');
  }
  if (property.media.length !== mediaIds.length) {
    throw new StudioVideoJobError('Seçilen fotoğraflardan biri kullanılamıyor veya başka şirkete ait.', 403, 'MEDIA_FORBIDDEN');
  }
  const mediaById = new Map(property.media.map((item) => [item.id, item]));
  const media = mediaIds.map((id) => mediaById.get(id)).filter(Boolean) as typeof property.media;
  const allowedUrls = new Set(media.map((item) => item.url));
  if (storyboard.photoUrls.some((url) => !allowedUrls.has(url))) {
    throw new StudioVideoJobError('Video planındaki bir görsel bu portföye ait değil.', 403, 'MEDIA_FORBIDDEN');
  }
  const snapshot: BrowserSnapshot = { media, storyboard, fingerprint, seed: input.seed };

  return client.studioVideoJob.upsert({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.actor.companyAccountId,
        idempotencyKey,
      },
    },
    create: {
      companyAccountId: input.actor.companyAccountId,
      propertyId: property.id,
      createdByMemberId: input.actor.memberId,
      prompt: storyboard.planSummary,
      userCommand: command,
      referenceMediaIds: mediaIds,
      referenceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      provider: BROWSER_PROVIDER,
      model: BROWSER_MODEL,
      durationSeconds: 15,
      ratio: '9:16',
      resolution: '1080p',
      generateAudio: false,
      status: 'QUEUED',
      progress: 0,
      idempotencyKey,
      nextAttemptAt: null,
    },
    update: {},
  });
}

export async function listBrowserRemotionJobs(
  actor: StudioVideoActor,
  client: BrowserVideoClient = prisma,
) {
  return client.studioVideoJob.findMany({
    where: ownedWhere(actor),
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

function targetStatus(stage: BrowserRemotionStage): StudioVideoJobStatus {
  if (stage === 'CHECKING' || stage === 'RETRY') return 'SUBMITTING';
  if (stage === 'RENDERING') return 'GENERATING';
  if (stage === 'ENCODING') return 'PERSISTING';
  return stage;
}

function transitionAllowed(current: StudioVideoJobStatus, stage: BrowserRemotionStage) {
  if (stage === 'RETRY') return ['FAILED', 'CANCELLED'].includes(current);
  const target = targetStatus(stage);
  if (current === target) return true;
  if (['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(current)) return false;
  if (target === 'FAILED' || target === 'CANCELLED') return true;
  const rank: Partial<Record<StudioVideoJobStatus, number>> = {
    QUEUED: 0,
    SUBMITTING: 1,
    GENERATING: 2,
    PERSISTING: 3,
    COMPLETED: 4,
  };
  return (rank[target] ?? -1) >= (rank[current] ?? 99);
}

export async function updateBrowserRemotionJob(
  actor: StudioVideoActor,
  jobId: string,
  input: {
    stage: BrowserRemotionStage;
    progress: number;
    outputFileName?: string;
    outputMimeType?: string;
    outputByteSize?: number;
    errorMessage?: string;
  },
  now = new Date(),
  client: BrowserVideoClient = prisma,
) {
  const current = await client.studioVideoJob.findFirst({
    where: { id: jobId, ...ownedWhere(actor) },
  });
  if (!current) throw new StudioVideoJobError('Video işi bulunamadı.', 404, 'JOB_NOT_FOUND');
  const target = targetStatus(input.stage);
  const progress = Math.min(100, Math.max(0, Math.round(input.progress)));
  if (current.status === target && input.stage !== 'RETRY') {
    if (progress <= current.progress || ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(target)) {
      return current;
    }
    await client.studioVideoJob.updateMany({
      where: {
        id: current.id,
        ...ownedWhere(actor),
        status: current.status,
        progress: { lt: progress },
      },
      data: { progress },
    });
    return (
      (await client.studioVideoJob.findFirst({
        where: { id: current.id, ...ownedWhere(actor) },
      })) || current
    );
  }
  if (!transitionAllowed(current.status, input.stage)) {
    throw new StudioVideoJobError('Video işi bu durumdan güncellenemez.', 409, 'INVALID_TRANSITION');
  }
  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(target);
  const data: Prisma.StudioVideoJobUpdateManyMutationInput = {
    status: target,
    progress,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    ...(input.stage === 'RETRY'
      ? {
          attemptCount: { increment: 1 },
          errorCode: null,
          errorMessage: null,
          completedAt: null,
          cancelledAt: null,
        }
      : {}),
    ...(target === 'SUBMITTING' && current.submittedAt === null ? { submittedAt: now } : {}),
    ...(target === 'COMPLETED'
      ? {
          completedAt: now,
          outputStorageKey: null,
          outputFileName: input.outputFileName?.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180) || 'portfoy-tanitim.mp4',
          outputMimeType: input.outputMimeType === 'video/mp4' ? 'video/mp4' : 'video/mp4',
          outputByteSize: Math.max(0, Math.round(input.outputByteSize || 0)),
          errorCode: null,
          errorMessage: null,
        }
      : {}),
    ...(target === 'FAILED'
      ? { errorCode: 'BROWSER_RENDER_FAILED', errorMessage: (input.errorMessage || 'Tarayıcı video renderı tamamlanamadı.').slice(0, 1_000) }
      : {}),
    ...(target === 'CANCELLED' ? { cancelledAt: now } : {}),
    ...(terminal ? { leaseOwner: null, leaseExpiresAt: null } : {}),
  };
  const updated = await client.studioVideoJob.updateMany({
    where: { id: current.id, ...ownedWhere(actor), status: current.status },
    data,
  });
  const latest = await client.studioVideoJob.findFirst({
    where: { id: current.id, ...ownedWhere(actor) },
  });
  if (updated.count === 0 && latest?.status !== target) {
    throw new StudioVideoJobError('Video işi başka bir işlem tarafından güncellendi.', 409, 'CONCURRENT_UPDATE');
  }
  return latest || current;
}
