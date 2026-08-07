import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  serializeBrowserRemotionJob,
  updateBrowserRemotionJob,
} from '@/lib/studio-video/browser-jobs';
import {
  studioVideoActor,
  studioVideoHttpError,
  studioVideoJobParamsSchema,
} from '../../jobs/route-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateSchema = z.object({
  stage: z.enum(['CHECKING', 'RENDERING', 'ENCODING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRY']),
  progress: z.number().min(0).max(100),
  outputFileName: z.string().trim().min(1).max(180).optional(),
  outputMimeType: z.literal('video/mp4').optional(),
  outputByteSize: z.number().int().nonnegative().max(250_000_000).optional(),
  errorMessage: z.string().trim().min(1).max(1_000).optional(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { jobId } = studioVideoJobParamsSchema.parse(await context.params);
    const input = updateSchema.parse(await request.json());
    const job = await updateBrowserRemotionJob(studioVideoActor(principal), jobId, input);
    return NextResponse.json({ job: serializeBrowserRemotionJob(job) });
  } catch (error) {
    return studioVideoHttpError(error, 'Video işi güncellenemedi.');
  }
}
