import { NextResponse } from 'next/server';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HistoryPhoto = {
  id: string;
  name: string;
  url: string;
  format: 'post' | 'story';
  createdAt: string;
  byteSize: number | null;
};

type HistoryVideo = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  ratio: string;
  createdAt: string;
  byteSize: number | null;
};

type HistoryFolder = {
  id: string;
  propertyId: string | null;
  name: string;
  location: string | null;
  latestAt: string;
  photos: HistoryPhoto[];
  videos: HistoryVideo[];
};

function firstReferenceUrl(snapshot: unknown) {
  if (!Array.isArray(snapshot)) return null;
  for (const entry of snapshot) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'url' in entry &&
      typeof entry.url === 'string' &&
      entry.url.trim()
    ) {
      return entry.url;
    }
  }
  return null;
}

function posterFormat(storageKey: string | null): 'post' | 'story' {
  return storageKey?.toLowerCase().endsWith('-story.jpg') ? 'story' : 'post';
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const memberScope = principal.member?.id
      ? { createdByMemberId: principal.member.id }
      : {};
    const [posterAttempts, videoJobs] = await Promise.all([
      prisma.studioPosterGenerationAttempt.findMany({
        where: {
          companyAccountId: principal.account.id,
          status: 'SUCCEEDED',
          outputUrl: { not: null },
          generation: memberScope,
        },
        select: {
          id: true,
          sequence: true,
          outputUrl: true,
          outputStorageKey: true,
          outputByteSize: true,
          completedAt: true,
          createdAt: true,
          generation: {
            select: {
              propertyId: true,
              property: {
                select: { title: true, location: true },
              },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 120,
      }),
      prisma.studioVideoJob.findMany({
        where: {
          companyAccountId: principal.account.id,
          ...memberScope,
          status: 'COMPLETED',
          outputStorageKey: { not: null },
        },
        select: {
          id: true,
          propertyId: true,
          property: { select: { title: true, location: true } },
          referenceSnapshot: true,
          durationSeconds: true,
          ratio: true,
          outputFileName: true,
          outputByteSize: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 120,
      }),
    ]);

    const folders = new Map<string, HistoryFolder>();
    const folderFor = (input: {
      propertyId: string | null;
      title: string | null | undefined;
      location: string | null | undefined;
      createdAt: Date;
    }) => {
      const id = input.propertyId || 'unfiled';
      const existing = folders.get(id);
      if (existing) {
        if (input.createdAt.getTime() > new Date(existing.latestAt).getTime()) {
          existing.latestAt = input.createdAt.toISOString();
        }
        return existing;
      }
      const folder: HistoryFolder = {
        id,
        propertyId: input.propertyId,
        name: input.title?.trim() || 'Portföye bağlı olmayan çalışmalar',
        location: input.location?.trim() || null,
        latestAt: input.createdAt.toISOString(),
        photos: [],
        videos: [],
      };
      folders.set(id, folder);
      return folder;
    };

    for (const attempt of posterAttempts) {
      if (!attempt.outputUrl) continue;
      const createdAt = attempt.completedAt || attempt.createdAt;
      const folder = folderFor({
        propertyId: attempt.generation.propertyId,
        title: attempt.generation.property?.title,
        location: attempt.generation.property?.location,
        createdAt,
      });
      folder.photos.push({
        id: attempt.id,
        name: `${folder.name} · Poster ${attempt.sequence + 1}`,
        url: attempt.outputUrl,
        format: posterFormat(attempt.outputStorageKey),
        createdAt: createdAt.toISOString(),
        byteSize: attempt.outputByteSize,
      });
    }

    for (const job of videoJobs) {
      const createdAt = job.completedAt || job.createdAt;
      const folder = folderFor({
        propertyId: job.propertyId,
        title: job.property.title,
        location: job.property.location,
        createdAt,
      });
      folder.videos.push({
        id: job.id,
        name: job.outputFileName || `${folder.name} · Video`,
        url: `/api/fabrika/studio/video/jobs/${encodeURIComponent(job.id)}/artifact`,
        thumbnailUrl: firstReferenceUrl(job.referenceSnapshot),
        durationSeconds: job.durationSeconds,
        ratio: job.ratio,
        createdAt: createdAt.toISOString(),
        byteSize: job.outputByteSize,
      });
    }

    return NextResponse.json(
      {
        folders: Array.from(folders.values()).sort(
          (left, right) =>
            new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime()
        ),
        totals: {
          photos: posterAttempts.filter((attempt) => Boolean(attempt.outputUrl)).length,
          videos: videoJobs.length,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof FabrikaSessionError
            ? error.message
            : 'Fotoğraf ve video geçmişi alınamadı.',
      },
      { status: error instanceof FabrikaSessionError ? 401 : 500 }
    );
  }
}
