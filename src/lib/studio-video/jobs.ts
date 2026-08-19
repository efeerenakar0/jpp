import "server-only";

import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { del } from "@vercel/blob";
import type {
  PrismaClient,
  StudioVideoJob,
  StudioVideoJobStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { persistStudioVideoArtifact } from "./artifact-storage";
import {
  buildStudioVideoPrompt,
  studioVideoProgress,
  studioVideoRetryDelayMs,
} from "./job-rules";
import {
  configuredStudioVideoProvider,
  StudioVideoProviderConfigurationError,
  StudioVideoProviderError,
  type StudioVideoProvider,
} from "./provider";
import { directStudioVideoCommand } from "./prompt-director";

const RETENTION_DAYS = 7;
const WORKER_LEASE_MS = 4 * 60_000;
const POLL_INTERVAL_MS = 20_000;
const MAX_ATTEMPTS = 4;

type StudioVideoClient = Pick<
  PrismaClient,
  "crmProperty" | "studioVideoJob" | "operationEvent"
>;

export type StudioVideoActor = {
  companyAccountId: string;
  memberId: string | null;
};

export class StudioVideoJobError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.name = "StudioVideoJobError";
    this.status = status;
    this.code = code;
  }
}

type ReferenceSnapshot = Array<{
  id: string;
  url: string;
  fileName: string;
  isCover: boolean;
}>;

function asReferenceSnapshot(value: unknown): ReferenceSnapshot {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.url !== "string" ||
      !record.url.startsWith("https://") ||
      typeof record.fileName !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        url: record.url,
        fileName: record.fileName,
        isCover: Boolean(record.isCover),
      },
    ];
  });
}

function future(now: Date, milliseconds: number) {
  return new Date(now.getTime() + milliseconds);
}

function retentionExpiry(now: Date) {
  return future(now, RETENTION_DAYS * 24 * 60 * 60_000);
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      return false;
    }
    const hostname = url.hostname
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan")
    ) {
      return false;
    }
    const ipVersion = isIP(hostname);
    if (ipVersion === 4) return !isPrivateIpv4(hostname);
    if (ipVersion === 6) {
      const normalized = hostname.toLowerCase();
      if (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb") ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:")
      ) {
        return false;
      }
      if (normalized.startsWith("::ffff:")) {
        const mappedIpv4 = normalized.slice("::ffff:".length);
        return isIP(mappedIpv4) === 4 && !isPrivateIpv4(mappedIpv4);
      }
      return true;
    }
    return hostname.includes(".");
  } catch {
    return false;
  }
}

export function serializeStudioVideoJob(job: StudioVideoJob) {
  return {
    id: job.id,
    propertyId: job.propertyId,
    userCommand: job.userCommand,
    status: job.status,
    progress: job.progress,
    durationSeconds: job.durationSeconds,
    ratio: job.ratio,
    resolution: job.resolution,
    referenceMediaIds: job.referenceMediaIds,
    outputFileName: job.outputFileName,
    outputMimeType: job.outputMimeType,
    outputByteSize: job.outputByteSize,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    submittedAt: job.submittedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    expiresAt: job.expiresAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    artifactHref:
      job.status === "COMPLETED" && job.outputStorageKey
        ? `/api/fabrika/studio/video/jobs/${encodeURIComponent(job.id)}/artifact`
        : null,
  };
}

export async function createStudioVideoJob(
  input: {
    actor: StudioVideoActor;
    propertyId: string;
    mediaIds: string[];
    command: string;
    durationSeconds?: number;
    ratio?: "9:16" | "16:9" | "1:1";
    resolution?: "720p" | "1080p";
    generateAudio?: boolean;
    idempotencyKey?: string | null;
    now?: Date;
  },
  client: StudioVideoClient = prisma,
) {
  const command = input.command.replace(/\s+/g, " ").trim();
  if (command.length < 3 || command.length > 1_000) {
    throw new StudioVideoJobError(
      "Yaratıcı talimat 3 ile 1.000 karakter arasında olmalıdır.",
    );
  }
  const mediaIds = [
    ...new Set(input.mediaIds.map((value) => value.trim())),
  ].filter(Boolean);
  if (!mediaIds.length || mediaIds.length > 9) {
    throw new StudioVideoJobError(
      "AI video için 1 ile 9 portföy fotoğrafı seçin.",
    );
  }
  const durationSeconds = input.durationSeconds ?? 10;
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 4 ||
    durationSeconds > 15
  ) {
    throw new StudioVideoJobError(
      "Video süresi 4 ile 15 saniye arasında olmalıdır.",
    );
  }

  const property = await client.crmProperty.findFirst({
    where: {
      id: input.propertyId,
      companyAccountId: input.actor.companyAccountId,
      status: { in: ["DRAFT", "ACTIVE", "RESERVED"] },
    },
    include: {
      media: {
        where: {
          id: { in: mediaIds },
          companyAccountId: input.actor.companyAccountId,
          archivedAt: null,
          mediaType: "PHOTO",
          usageRightsStatus: { not: "RESTRICTED" },
        },
        select: { id: true, url: true, fileName: true, isCover: true },
      },
    },
  });
  if (!property) {
    throw new StudioVideoJobError(
      "Portföy bulunamadı veya bu şirkete ait değil.",
      404,
      "PROPERTY_NOT_FOUND",
    );
  }
  if (property.media.length !== mediaIds.length) {
    throw new StudioVideoJobError(
      "Seçilen fotoğraflardan biri kullanılamıyor veya başka şirkete ait.",
      403,
      "MEDIA_FORBIDDEN",
    );
  }
  const byId = new Map(property.media.map((media) => [media.id, media]));
  const snapshot = mediaIds
    .map((id) => byId.get(id))
    .filter(Boolean) as ReferenceSnapshot;
  if (snapshot.some((media) => !isPublicHttpsUrl(media.url))) {
    throw new StudioVideoJobError(
      "Seçilen fotoğraflardan biri AI video sağlayıcısının erişebileceği herkese açık bir HTTPS adresinde değil. Fotoğrafı yeniden yükleyip tekrar deneyin.",
      422,
      "MEDIA_NOT_PUBLIC",
    );
  }
  const now = input.now ?? new Date();
  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const existing = await client.studioVideoJob.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.actor.companyAccountId,
        idempotencyKey,
      },
    },
  });
  if (existing) return existing;

  const directedCommand = await directStudioVideoCommand({
    command,
    referenceCount: snapshot.length,
  });
  const prompt = buildStudioVideoPrompt({
    command: directedCommand,
    property: {
      title: property.title,
      location: property.location,
      price: property.price,
      roomCount: property.roomCount,
      area: property.area,
      description: property.description,
    },
  });
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
      prompt,
      userCommand: command,
      referenceMediaIds: mediaIds,
      referenceSnapshot: snapshot,
      provider: "BYTEPLUS",
      model:
        process.env.BYTEPLUS_SEEDANCE_MODEL || "dreamina-seedance-2-0-260128",
      durationSeconds,
      ratio: input.ratio ?? "9:16",
      resolution: input.resolution ?? "720p",
      generateAudio: input.generateAudio ?? false,
      status: "QUEUED",
      progress: studioVideoProgress("QUEUED"),
      idempotencyKey,
      nextAttemptAt: now,
    },
    update: {},
  });
}

export async function getOwnedStudioVideoJob(
  actor: StudioVideoActor,
  jobId: string,
  client: StudioVideoClient = prisma,
) {
  const job = await client.studioVideoJob.findFirst({
    where: {
      id: jobId,
      companyAccountId: actor.companyAccountId,
      ...(actor.memberId ? { createdByMemberId: actor.memberId } : {}),
    },
  });
  if (!job) {
    throw new StudioVideoJobError(
      "Video işi bulunamadı.",
      404,
      "JOB_NOT_FOUND",
    );
  }
  return job;
}

export async function listStudioVideoJobs(
  actor: StudioVideoActor,
  client: StudioVideoClient = prisma,
) {
  return client.studioVideoJob.findMany({
    where: {
      companyAccountId: actor.companyAccountId,
      ...(actor.memberId ? { createdByMemberId: actor.memberId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

function errorDetails(error: unknown) {
  if (error instanceof StudioVideoProviderConfigurationError) {
    return { code: "NOT_CONFIGURED", message: error.message, transient: false };
  }
  if (error instanceof StudioVideoProviderError) {
    return {
      code: error.code,
      message: error.message,
      transient: ["RATE_LIMITED", "PROVIDER_UNAVAILABLE"].includes(error.code),
    };
  }
  const message =
    error instanceof Error ? error.message : "AI video işi işlenemedi.";
  return { code: "PROCESSING_ERROR", message, transient: true };
}

async function finishPersisting(
  job: StudioVideoJob,
  input: {
    now: Date;
    workerId: string;
    client: StudioVideoClient;
    persistArtifact: typeof persistStudioVideoArtifact;
  },
) {
  if (!job.providerOutputUrl) {
    throw new StudioVideoJobError(
      "Sağlayıcı video çıktısı bulunamadı.",
      500,
      "OUTPUT_MISSING",
    );
  }
  const artifact = await input.persistArtifact({
    companyAccountId: job.companyAccountId,
    jobId: job.id,
    sourceUrl: job.providerOutputUrl,
  });
  const completed = await input.client.studioVideoJob.updateMany({
    where: { id: job.id, status: "PERSISTING", leaseOwner: input.workerId },
    data: {
      status: "COMPLETED",
      progress: studioVideoProgress("COMPLETED"),
      outputStorageKey: artifact.storageKey,
      outputFileName: artifact.fileName,
      outputMimeType: artifact.mimeType,
      outputByteSize: artifact.byteSize,
      providerOutputUrl: null,
      completedAt: input.now,
      expiresAt: retentionExpiry(input.now),
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
  if (!completed.count) return null;
  await input.client.operationEvent
    .upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: job.companyAccountId,
          idempotencyKey: `studio-video-completed:${job.id}`,
        },
      },
      create: {
        companyAccountId: job.companyAccountId,
        eventType: "STUDIO_JOB_COMPLETED",
        entityType: "StudioVideoJob",
        entityId: job.id,
        propertyId: job.propertyId,
        actorType: "SYSTEM",
        metadata: {
          status: "COMPLETED",
          outputMimeType: artifact.mimeType,
          outputByteSize: artifact.byteSize,
        },
        idempotencyKey: `studio-video-completed:${job.id}`,
      },
      update: {},
    })
    .catch(() => undefined);
  return input.client.studioVideoJob.findUnique({ where: { id: job.id } });
}

export async function processNextStudioVideoJob(
  input: {
    now?: Date;
    workerId?: string;
    client?: StudioVideoClient;
    provider?: StudioVideoProvider;
    persistArtifact?: typeof persistStudioVideoArtifact;
  } = {},
) {
  const now = input.now ?? new Date();
  const workerId = input.workerId ?? `studio-video-worker:${randomUUID()}`;
  const client = input.client ?? prisma;
  const provider = input.provider ?? configuredStudioVideoProvider();
  const persistArtifact = input.persistArtifact ?? persistStudioVideoArtifact;
  const candidate = await client.studioVideoJob.findFirst({
    where: {
      provider: { not: "BANNERBEAR" },
      status: { in: ["QUEUED", "GENERATING", "PERSISTING"] },
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await client.studioVideoJob.updateMany({
    where: {
      id: candidate.id,
      provider: { not: "BANNERBEAR" },
      status: candidate.status,
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ],
    },
    data: {
      leaseOwner: workerId,
      leaseExpiresAt: future(now, WORKER_LEASE_MS),
      nextAttemptAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
  if (!claimed.count) return null;

  let recoveryStatus: StudioVideoJobStatus = candidate.status;
  let submittedTaskId: string | null = null;
  try {
    if (candidate.status === "QUEUED") {
      await client.studioVideoJob.updateMany({
        where: { id: candidate.id, status: "QUEUED", leaseOwner: workerId },
        data: {
          status: "SUBMITTING",
          progress: studioVideoProgress("SUBMITTING"),
          attemptCount: { increment: 1 },
        },
      });
      const references = asReferenceSnapshot(candidate.referenceSnapshot);
      if (references.length !== candidate.referenceMediaIds.length) {
        throw new StudioVideoJobError(
          "Video referans fotoğrafları doğrulanamadı.",
          500,
          "REFERENCE_INVALID",
        );
      }
      const submitted = await provider.submit({
        prompt: candidate.prompt,
        referenceImageUrls: references.map((reference) => reference.url),
        durationSeconds: candidate.durationSeconds,
        ratio: candidate.ratio as "9:16" | "16:9" | "1:1" | "adaptive",
        resolution: candidate.resolution as "480p" | "720p" | "1080p",
        generateAudio: candidate.generateAudio,
      });
      submittedTaskId = submitted.providerTaskId;
      await client.studioVideoJob.updateMany({
        where: { id: candidate.id, status: "SUBMITTING", leaseOwner: workerId },
        data: {
          status: "GENERATING",
          progress: 25,
          providerTaskId: submitted.providerTaskId,
          submittedAt: now,
          nextAttemptAt: future(now, POLL_INTERVAL_MS),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return {
        ok: true as const,
        jobId: candidate.id,
        status: "GENERATING" as const,
      };
    }

    if (candidate.status === "GENERATING") {
      if (!candidate.providerTaskId) {
        throw new StudioVideoJobError(
          "Sağlayıcı görev kimliği bulunamadı.",
          500,
          "PROVIDER_TASK_MISSING",
        );
      }
      const result = await provider.retrieve(candidate.providerTaskId);
      if (result.status === "QUEUED" || result.status === "RUNNING") {
        await client.studioVideoJob.updateMany({
          where: {
            id: candidate.id,
            status: "GENERATING",
            leaseOwner: workerId,
          },
          data: {
            progress:
              result.status === "QUEUED"
                ? 35
                : studioVideoProgress("GENERATING"),
            nextAttemptAt: future(now, POLL_INTERVAL_MS),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        return {
          ok: true as const,
          jobId: candidate.id,
          status: "GENERATING" as const,
        };
      }
      if (result.status !== "SUCCEEDED" || !result.outputUrl) {
        const terminalStatus: StudioVideoJobStatus =
          result.status === "CANCELLED"
            ? "CANCELLED"
            : result.status === "EXPIRED"
              ? "EXPIRED"
              : "FAILED";
        await client.studioVideoJob.updateMany({
          where: {
            id: candidate.id,
            status: "GENERATING",
            leaseOwner: workerId,
          },
          data: {
            status: terminalStatus,
            progress: 100,
            errorCode: `PROVIDER_${result.status}`,
            errorMessage:
              terminalStatus === "FAILED"
                ? "AI video sağlayıcısı bu işi tamamlayamadı."
                : null,
            nextAttemptAt: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            ...(terminalStatus === "CANCELLED" ? { cancelledAt: now } : {}),
          },
        });
        return {
          ok: terminalStatus !== "FAILED",
          jobId: candidate.id,
          status: terminalStatus,
        };
      }
      recoveryStatus = "PERSISTING";
      const movedToPersisting = await client.studioVideoJob.updateMany({
        where: { id: candidate.id, status: "GENERATING", leaseOwner: workerId },
        data: {
          status: "PERSISTING",
          progress: studioVideoProgress("PERSISTING"),
          providerOutputUrl: result.outputUrl,
        },
      });
      if (!movedToPersisting.count) {
        const current = await client.studioVideoJob.findUnique({
          where: { id: candidate.id },
        });
        if (!current) return null;
        return {
          ok: current.status === "CANCELLED",
          jobId: candidate.id,
          status: current.status,
        };
      }
      const persisting = await client.studioVideoJob.findUnique({
        where: { id: candidate.id },
      });
      if (!persisting) return null;
      const completed = await finishPersisting(persisting, {
        now,
        workerId,
        client,
        persistArtifact,
      });
      return {
        ok: Boolean(completed),
        jobId: candidate.id,
        status: completed ? ("COMPLETED" as const) : ("PERSISTING" as const),
      };
    }

    const completed = await finishPersisting(candidate, {
      now,
      workerId,
      client,
      persistArtifact,
    });
    return {
      ok: Boolean(completed),
      jobId: candidate.id,
      status: completed ? ("COMPLETED" as const) : ("PERSISTING" as const),
    };
  } catch (error) {
    if (submittedTaskId) {
      await client.studioVideoJob.updateMany({
        where: { id: candidate.id, status: "SUBMITTING", leaseOwner: workerId },
        data: {
          status: "GENERATING",
          providerTaskId: submittedTaskId,
          submittedAt: now,
          progress: 25,
          nextAttemptAt: future(now, POLL_INTERVAL_MS),
          leaseOwner: null,
          leaseExpiresAt: null,
          errorCode: "SUBMIT_RESULT_RECOVERED",
          errorMessage:
            "Sağlayıcı görevi alındı; durum kontrolü yeniden denenecek.",
        },
      });
      return {
        ok: true as const,
        jobId: candidate.id,
        status: "GENERATING" as const,
      };
    }
    const details = errorDetails(error);
    const attemptCount = candidate.attemptCount + 1;
    const retry = details.transient && attemptCount < MAX_ATTEMPTS;
    await client.studioVideoJob.updateMany({
      where: {
        id: candidate.id,
        leaseOwner: workerId,
        status: { in: ["SUBMITTING", "GENERATING", "PERSISTING"] },
      },
      data: {
        status: retry ? recoveryStatus : "FAILED",
        progress: retry ? studioVideoProgress(recoveryStatus) : 100,
        attemptCount: { increment: candidate.status === "QUEUED" ? 0 : 1 },
        nextAttemptAt: retry
          ? future(now, studioVideoRetryDelayMs(attemptCount))
          : null,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: details.code,
        errorMessage: details.message.slice(0, 2_000),
      },
    });
    return {
      ok: false as const,
      jobId: candidate.id,
      status: retry ? recoveryStatus : ("FAILED" as const),
      retryScheduled: retry,
      error: details.message,
    };
  }
}

export async function cancelStudioVideoJob(
  actor: StudioVideoActor,
  jobId: string,
  input: {
    client?: StudioVideoClient;
    provider?: StudioVideoProvider;
    now?: Date;
  } = {},
) {
  const client = input.client ?? prisma;
  const job = await getOwnedStudioVideoJob(actor, jobId, client);
  if (["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(job.status)) {
    return job;
  }
  const cancelled = await client.studioVideoJob.updateMany({
    where: {
      id: job.id,
      companyAccountId: actor.companyAccountId,
      status: { in: ["QUEUED", "SUBMITTING", "GENERATING", "PERSISTING"] },
    },
    data: {
      status: "CANCELLED",
      progress: 100,
      cancelledAt: input.now ?? new Date(),
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
  if (!cancelled.count) {
    return getOwnedStudioVideoJob(actor, job.id, client);
  }
  if (job.providerTaskId) {
    try {
      await (input.provider ?? configuredStudioVideoProvider()).cancel(
        job.providerTaskId,
      );
    } catch {
      // Local cancellation remains authoritative. Worker state transitions use
      // status compare-and-set, so a late provider result cannot revive this job.
    }
  }
  return getOwnedStudioVideoJob(actor, job.id, client);
}

export async function cleanupExpiredStudioVideoJobs(
  input: {
    now?: Date;
    limit?: number;
    client?: StudioVideoClient;
    deleter?: typeof del;
  } = {},
) {
  const now = input.now ?? new Date();
  const client = input.client ?? prisma;
  const jobs = await client.studioVideoJob.findMany({
    where: { status: "COMPLETED", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: Math.max(1, Math.min(input.limit ?? 25, 100)),
  });
  for (const job of jobs) {
    if (job.outputStorageKey) {
      await (input.deleter ?? del)(job.outputStorageKey);
    }
    await client.studioVideoJob.updateMany({
      where: { id: job.id, status: "COMPLETED", expiresAt: { lte: now } },
      data: {
        status: "EXPIRED",
        progress: 100,
        outputStorageKey: null,
        outputFileName: null,
        outputMimeType: null,
        outputByteSize: null,
      },
    });
  }
  return jobs.length;
}
