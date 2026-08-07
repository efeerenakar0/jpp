import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  createBrowserRemotionJob,
  listBrowserRemotionJobs,
  serializeBrowserRemotionJob,
} from '@/lib/studio-video/browser-jobs';
import { studioVideoActor, studioVideoHttpError } from '../jobs/route-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createSchema = z.object({
  propertyId: z.string().trim().min(1).max(200),
  mediaIds: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  command: z.string().trim().min(3).max(1_000),
  storyboard: z.unknown(),
  fingerprint: z.string().trim().min(1).max(80),
  seed: z.number().int().min(0).max(2_147_483_647),
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const jobs = await listBrowserRemotionJobs(studioVideoActor(principal));
    return NextResponse.json({ jobs: jobs.map(serializeBrowserRemotionJob) });
  } catch (error) {
    return studioVideoHttpError(error, 'Video geçmişi alınamadı.');
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const input = createSchema.parse(await request.json());
    const job = await createBrowserRemotionJob({
      actor: studioVideoActor(principal),
      ...input,
    });
    return NextResponse.json({ job: serializeBrowserRemotionJob(job) }, { status: 201 });
  } catch (error) {
    return studioVideoHttpError(error, 'Video işi kaydedilemedi.');
  }
}
