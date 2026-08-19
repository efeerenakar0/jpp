import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  BannerbearVideoError,
  getBannerbearSlideshowStatus,
  submitBannerbearSlideshow,
  type BannerbearVideoTransition,
} from '@/lib/bannerbear-video';
import prisma from '@/lib/prisma';
import { persistStudioVideoArtifact } from '@/lib/studio-video/artifact-storage';

const ACTIVE_STATUSES = ['QUEUED', 'SUBMITTING', 'GENERATING', 'PERSISTING'] as const;
const LEASE_MS = 45_000;
const POLL_MS = 8_000;
const MAX_ATTEMPTS = 4;

type ReferenceSnapshot = { id: string; fileName?: string; url: string };

function references(value: unknown): ReferenceSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.url !== 'string') return [];
    return [{
      id: candidate.id,
      url: candidate.url,
      fileName: typeof candidate.fileName === 'string' ? candidate.fileName : undefined,
    }];
  });
}

function transitionFromCommand(command: string): BannerbearVideoTransition {
  const match = command.match(/\b(none|fade|dissolve|wipeleft|slideleft)\b/i)?.[1]?.toLowerCase();
  return (match || 'fade') as BannerbearVideoTransition;
}

function formatFromRatio(ratio: string) {
  return ratio === '9:16' ? 'story' as const : 'post' as const;
}

function nextDate(now: Date, milliseconds: number) {
  return new Date(now.getTime() + milliseconds);
}

export async function processNextBannerbearPosterVideoJob(input: {
  jobId?: string;
  now?: Date;
  workerId?: string;
} = {}) {
  const now = input.now ?? new Date();
  const workerId = input.workerId ?? `bannerbear-video:${randomUUID()}`;
  const candidate = await prisma.studioVideoJob.findFirst({
    where: {
      ...(input.jobId ? { id: input.jobId } : {}),
      provider: 'BANNERBEAR',
      status: { in: [...ACTIVE_STATUSES] },
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) return null;

  const claimed = await prisma.studioVideoJob.updateMany({
    where: {
      id: candidate.id,
      provider: 'BANNERBEAR',
      status: candidate.status,
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ],
    },
    data: {
      leaseOwner: workerId,
      leaseExpiresAt: nextDate(now, LEASE_MS),
      nextAttemptAt: null,
    },
  });
  if (!claimed.count) return null;

  let recoveryStatus = candidate.status;
  try {
    const snapshot = references(candidate.referenceSnapshot);
    if (snapshot.length < 2 || snapshot.length !== candidate.referenceMediaIds.length) {
      throw new BannerbearVideoError(
        'Video için kaydedilen portföy fotoğrafları doğrulanamadı.',
        'INVALID_INPUT',
        422
      );
    }
    const slideDuration = Math.min(
      5,
      Math.max(2, Math.round(candidate.durationSeconds / snapshot.length) || 3)
    );

    if ((candidate.status === 'QUEUED' || candidate.status === 'SUBMITTING') && !candidate.providerTaskId) {
      recoveryStatus = 'SUBMITTING';
      await prisma.studioVideoJob.updateMany({
        where: { id: candidate.id, leaseOwner: workerId, status: candidate.status },
        data: {
          status: 'SUBMITTING',
          progress: 10,
          attemptCount: { increment: 1 },
        },
      });
      const submitted = await submitBannerbearSlideshow({
        apiKey: process.env.BANNERBEAR_API_KEY,
        imageUrls: snapshot.map((item) => item.url),
        format: formatFromRatio(candidate.ratio),
        slideDuration,
        transition: transitionFromCommand(candidate.userCommand),
        metadata: JSON.stringify({
          companyAccountId: candidate.companyAccountId,
          propertyId: candidate.propertyId,
          studioVideoJobId: candidate.id,
        }),
      });
      await prisma.studioVideoJob.updateMany({
        where: { id: candidate.id, leaseOwner: workerId, status: 'SUBMITTING' },
        data: {
          status: 'GENERATING',
          progress: 15,
          providerTaskId: submitted.providerRequestId,
          submittedAt: now,
          nextAttemptAt: nextDate(now, POLL_MS),
          leaseOwner: null,
          leaseExpiresAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      return { ok: true as const, jobId: candidate.id, status: 'GENERATING' as const };
    }

    if (candidate.status === 'GENERATING' || candidate.providerTaskId) {
      recoveryStatus = 'GENERATING';
      if (!candidate.providerTaskId) {
        throw new BannerbearVideoError(
          'Bannerbear video görev kimliği bulunamadı.',
          'INVALID_PROVIDER_RESPONSE'
        );
      }
      const state = await getBannerbearSlideshowStatus({
        apiKey: process.env.BANNERBEAR_API_KEY,
        providerRequestId: candidate.providerTaskId,
      });
      if (state.status === 'PENDING' || state.status === 'RUNNING') {
        await prisma.studioVideoJob.updateMany({
          where: { id: candidate.id, leaseOwner: workerId, status: candidate.status },
          data: {
            status: 'GENERATING',
            progress: Math.min(88, Math.max(15, state.progress)),
            nextAttemptAt: nextDate(now, POLL_MS),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        return { ok: true as const, jobId: candidate.id, status: 'GENERATING' as const };
      }
      if (state.status === 'FAILED') {
        throw new BannerbearVideoError(state.errorMessage, 'PROVIDER_ERROR');
      }
      if (state.status !== 'COMPLETED') {
        throw new BannerbearVideoError(
          'Bannerbear video durumu doğrulanamadı.',
          'INVALID_PROVIDER_RESPONSE'
        );
      }
      await prisma.studioVideoJob.updateMany({
        where: { id: candidate.id, leaseOwner: workerId, status: candidate.status },
        data: {
          status: 'PERSISTING',
          progress: 92,
          providerOutputUrl: state.videoUrl,
        },
      });
      candidate.providerOutputUrl = state.videoUrl;
      recoveryStatus = 'PERSISTING';
    }

    const sourceUrl = candidate.providerOutputUrl;
    if (!sourceUrl) {
      throw new BannerbearVideoError(
        'Tamamlanan Bannerbear video adresi bulunamadı.',
        'INVALID_PROVIDER_RESPONSE'
      );
    }
    const stored = await persistStudioVideoArtifact({
      companyAccountId: candidate.companyAccountId,
      jobId: candidate.id,
      sourceUrl,
    });
    await prisma.studioVideoJob.updateMany({
      where: { id: candidate.id, leaseOwner: workerId, status: 'PERSISTING' },
      data: {
        status: 'COMPLETED',
        progress: 100,
        outputStorageKey: stored.storageKey,
        outputFileName: stored.fileName,
        outputMimeType: stored.mimeType,
        outputByteSize: stored.byteSize,
        completedAt: now,
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
    return { ok: true as const, jobId: candidate.id, status: 'COMPLETED' as const };
  } catch (error) {
    const attemptCount = candidate.attemptCount + 1;
    const retry = attemptCount < MAX_ATTEMPTS &&
      !(error instanceof BannerbearVideoError && ['INVALID_INPUT', 'NOT_CONFIGURED', 'PERMISSION_DENIED', 'QUOTA_EXHAUSTED'].includes(error.code));
    await prisma.studioVideoJob.updateMany({
      where: { id: candidate.id, leaseOwner: workerId, status: { in: [...ACTIVE_STATUSES] } },
      data: {
        status: retry ? recoveryStatus : 'FAILED',
        progress: retry ? Math.max(10, candidate.progress) : 100,
        attemptCount: { increment: candidate.status === 'QUEUED' ? 0 : 1 },
        nextAttemptAt: retry ? nextDate(now, 20_000) : null,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: error instanceof BannerbearVideoError ? error.code : 'VIDEO_RENDER_FAILED',
        errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : 'Video hazırlanamadı.',
      },
    });
    return { ok: false as const, jobId: candidate.id, status: retry ? recoveryStatus : 'FAILED' as const };
  }
}
