import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from "@/lib/fabrika-session";
import { isHunterEnabled } from "@/lib/company-accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const companyAccountId = principal.account.id;
    const [studio, studioVideo, hunting] = await Promise.all([
      prisma.studioBatch.findMany({
        where: {
          companyAccountId,
          status: { in: ["PENDING", "UPLOADING", "PROCESSING"] },
          ...(principal.member
            ? { createdByMemberId: principal.member.id }
            : {}),
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          items: { select: { status: true } },
          property: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.studioVideoJob.findMany({
        where: {
          companyAccountId,
          status: { in: ["QUEUED", "SUBMITTING", "GENERATING", "PERSISTING"] },
          ...(principal.member
            ? { createdByMemberId: principal.member.id }
            : {}),
        },
        select: {
          id: true,
          status: true,
          progress: true,
          createdAt: true,
          property: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      isHunterEnabled(principal.account)
        ? prisma.huntJob.findMany({
            where: {
              companyAccountId,
              status: {
                in: ["QUEUED", "RUNNING", "PAUSED", "SOURCE_CHALLENGE"],
              },
            },
            select: {
              id: true,
              status: true,
              searchUrl: true,
              totalCompleted: true,
              totalDiscovered: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      jobs: [
        ...studio.map((job) => {
          const completed = job.items.filter((item) =>
            ["COMPLETED", "ATTACHED"].includes(item.status),
          ).length;
          return {
            id: `studio:${job.id}`,
            kind: "STUDIO",
            title: job.property?.title || "Stüdyo görsel işlemi",
            status: job.status,
            progress: job.items.length
              ? Math.round((completed / job.items.length) * 100)
              : 0,
            href: "/fabrika/studyo#studio-recent",
            createdAt: job.createdAt,
          };
        }),
        ...studioVideo.map((job) => ({
          id: `studio-video:${job.id}`,
          kind: "STUDIO_VIDEO",
          title: job.property?.title || "AI video üretimi",
          status: job.status,
          progress: Math.max(0, Math.min(100, job.progress)),
          href: "/fabrika/studyo?area=video",
          createdAt: job.createdAt,
        })),
        ...hunting.map((job) => ({
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
