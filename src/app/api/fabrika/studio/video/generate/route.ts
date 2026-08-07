import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { aiVideoDurationSchema, aiVideoFormatSchema } from '@/lib/portfolio-video/ai-video-types';
import { sanitizePortfolioForVideoModel, sanitizeVideoPrompt } from '@/lib/portfolio-video/ai-video-security';
import { generatePortfolioRemotionProgram } from '@/lib/portfolio-video/openrouter-video-generator';
import { loadPortfolioVideoCatalog } from '@/lib/portfolio-video/data';
import { createAiBrowserVideoJob, serializeAiBrowserJob } from '@/lib/studio-video/ai-browser-jobs';
import { studioVideoActor, studioVideoHttpError } from '../jobs/route-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const requestSchema = z.object({
  portfolioId: z.string().trim().min(1).max(120),
  selectedPhotoIds: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  prompt: z.string().trim().min(3).max(1_000),
  format: aiVideoFormatSchema,
  durationSeconds: aiVideoDurationSchema,
  creativeSeed: z.number().int().min(0).max(2_147_483_647),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const input = requestSchema.parse(await request.json());
    const catalog = await loadPortfolioVideoCatalog(principal);
    const portfolio = catalog.portfolios.find((item) => item.id === input.portfolioId);
    if (!portfolio) return NextResponse.json({ error: 'Portföy bulunamadı veya bu şirkete ait değil.' }, { status: 404 });
    const photoById = new Map(portfolio.photos.map((photo) => [photo.id, photo]));
    const selectedPhotos = input.selectedPhotoIds.map((id) => photoById.get(id));
    if (selectedPhotos.some((photo) => !photo)) return NextResponse.json({ error: 'Seçilen görsellerden biri bu portföye ait değil.' }, { status: 403 });
    const selectedPortfolio = { ...portfolio, photos: selectedPhotos.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)) };
    const sanitizedPortfolio = sanitizePortfolioForVideoModel(selectedPortfolio);
    const program = await generatePortfolioRemotionProgram({
      creativeSeed: input.creativeSeed, format: input.format, durationSeconds: input.durationSeconds,
      prompt: sanitizeVideoPrompt(input.prompt), portfolio: sanitizedPortfolio,
    }, { signal: request.signal });
    const job = await createAiBrowserVideoJob({
      actor: studioVideoActor(principal), portfolio: selectedPortfolio, mediaIds: input.selectedPhotoIds,
      command: input.prompt, format: input.format, durationSeconds: input.durationSeconds,
      plan: program.plan, code: program.code, codeHash: program.codeHash, model: program.model,
      attempts: program.attempts, idempotencyKey: input.idempotencyKey,
    });
    return NextResponse.json({ success: true, job: serializeAiBrowserJob(job) }, { status: 201 });
  } catch (error) {
    return studioVideoHttpError(error, 'AI video programı oluşturulamadı.');
  }
}
