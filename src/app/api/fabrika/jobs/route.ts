import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from "@/lib/fabrika-session";
import { isHunterEnabled } from "@/lib/company-accounts";

export const dynamic = "force-dynamic";

const QUEUED_JOB_STALE_MS = 15 * 60_000;
const WORKER_JOB_STALE_MS = 5 * 60_000;

function isRecent(value: Date | null, now: Date, maxAgeMs: number) {
  return Boolean(value && value.getTime() > now.getTime() - maxAgeMs);
}

function hasLiveStudioItem(
  item: {
    status: string;
    leaseExpiresAt: Date | null;
    updatedAt: Date;
  },
  now: Date,
) {
  if (item.status === "PROCESSING") {
    return item.leaseExpiresAt
      ? item.leaseExpiresAt > now
      : isRecent(item.updatedAt, now, WORKER_JOB_STALE_MS);
  }
  return (
    ["PENDING", "UPLOADING"].includes(item.status) &&
    isRecent(item.updatedAt, now, QUEUED_JOB_STALE_MS)
  );
}

function isLiveVideoJob(
  job: {
    status: string;
    leaseExpiresAt: Date | null;
    updatedAt: Date;
  },
  now: Date,
) {
  if (
    !["QUEUED", "SUBMITTING", "GENERATING", "PERSISTING"].includes(
      job.status,
    )
  ) {
    return false;
  }
  if (job.leaseExpiresAt && job.leaseExpiresAt > now) return true;
  return isRecent(
    job.updatedAt,
    now,
    job.status === "QUEUED" ? QUEUED_JOB_STALE_MS : WORKER_JOB_STALE_MS,
  );
}

function isLiveHuntJob(
  job: {
    status: string;
    lastHeartbeatAt: Date | null;
    updatedAt: Date;
  },
  now: Date,
) {
  if (job.status === "QUEUED") {
    return isRecent(job.updatedAt, now, QUEUED_JOB_STALE_MS);
  }
  if (job.status !== "RUNNING") return false;
  return isRecent(
    job.lastHeartbeatAt ?? job.updatedAt,
    now,
    WORKER_JOB_STALE_MS,
  );
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const companyAccountId = principal.account.id;
    const now = new Date();
    const queuedStaleBefore = new Date(now.getTime() - QUEUED_JOB_STALE_MS);
    const workerStaleBefore = new Date(now.getTime() - WORKER_JOB_STALE_MS);
    const [studio, studioVideo, hunting] = await Promise.all([
      prisma.studioBatch.findMany({
        where: {
          companyAccountId,
          status: { in: ["PENDING", "UPLOADING", "PROCESSING"] },
          items: {
            some: {
              OR: [
                {
                  status: "PROCESSING",
                  OR: [
                    { leaseExpiresAt: { gt: now } },
                    {
                      leaseExpiresAt: null,
                      updatedAt: { gt: workerStaleBefore },
                    },
                  ],
                },
                {
                  status: { in: ["PENDING", "UPLOADING"] },
                  updatedAt: { gt: queuedStaleBefore },
                },
              ],
            },
          },
          ...(principal.member
            ? { createdByMemberId: principal.member.id }
            : {}),
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              status: true,
              leaseExpiresAt: true,
              updatedAt: true,
            },
          },
          property: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.studioVideoJob.findMany({
        where: {
          companyAccountId,
          OR: [
            {
              status: "QUEUED",
              updatedAt: { gt: queuedStaleBefore },
            },
            {
              status: { in: ["SUBMITTING", "GENERATING", "PERSISTING"] },
              OR: [
                { leaseExpiresAt: { gt: now } },
                { updatedAt: { gt: workerStaleBefore } },
              ],
            },
          ],
          ...(principal.member
            ? { createdByMemberId: principal.member.id }
            : {}),
        },
        select: {
          id: true,
          status: true,
          progress: true,
          createdAt: true,
          updatedAt: true,
          leaseExpiresAt: true,
          property: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      isHunterEnabled(principal.account)
        ? prisma.huntJob.findMany({
            where: {
              companyAccountId,
              OR: [
                {
                  status: "QUEUED",
                  updatedAt: { gt: queuedStaleBefore },
                },
                {
                  status: "RUNNING",
                  OR: [
                    { lastHeartbeatAt: { gt: workerStaleBefore } },
                    {
                      lastHeartbeatAt: null,
                      updatedAt: { gt: workerStaleBefore },
                    },
                  ],
                },
              ],
            },
            select: {
              id: true,
              status: true,
              searchUrl: true,
              totalCompleted: true,
              totalDiscovered: true,
              createdAt: true,
              updatedAt: true,
              lastHeartbeatAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      jobs: [
        ...studio
          .filter((job) =>
            job.items.some((item) => hasLiveStudioItem(item, now)),
          )
          .map((job) => {
            const completed = job.items.filter((item) =>
              ["COMPLETED", "ATTACHED"].includes(item.status),
            ).length;
            return {
              id: `studio:${job.id}`,
              kind: "STUDIO",
              title: job.property?.title || "Stüdyo görsel işlemi",
              status: job.status,
              completed,
              total: job.items.length,
              progress: job.items.length
                ? Math.round((completed / job.items.length) * 100)
                : 0,
              href: "/fabrika/studyo#studio-recent",
              createdAt: job.createdAt,
            };
          }),
        ...studioVideo
          .filter((job) => isLiveVideoJob(job, now))
          .map((job) => ({
            id: `studio-video:${job.id}`,
            kind: "STUDIO_VIDEO",
            title: job.property?.title || "AI video üretimi",
            status: job.status,
            progress: Math.max(0, Math.min(100, job.progress)),
            href: "/fabrika/studyo?area=video",
            createdAt: job.createdAt,
          })),
        ...hunting
          .filter((job) => isLiveHuntJob(job, now))
          .map((job) => ({
            id: `hunt:${job.id}`,
            kind: "HUNT",
            title: "Avcı kaynak taraması",
            status: job.status,
            progress: job.totalDiscovered
              ? Math.round((job.totalCompleted / job.totalDiscovered) * 100)
              : 0,
            href: "/fabrika/avci",
            createdAt: job.createdAt,
          })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof FabrikaSessionError
            ? "Fabrika oturumu gerekli."
            : "İş merkezi yüklenemedi.",
      },
      { status: error instanceof FabrikaSessionError ? 401 : 500 },
    );
  }
}
