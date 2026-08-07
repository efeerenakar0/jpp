import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { aiVideoPlanSchema, type AiVideoDuration, type AiVideoFormat, type AiVideoPlan } from '@/lib/portfolio-video/ai-video-types';
import type { PortfolioVideoPortfolio } from '@/lib/portfolio-video/types';
import type { StudioVideoActor } from './jobs';
import { StudioVideoJobError } from './jobs';

export const AI_BROWSER_PROVIDER = 'BROWSER_REMOTION_AI';

type Client = Pick<PrismaClient, 'crmProperty' | 'studioVideoJob'>;

export type AiBrowserSnapshot = {
  kind: 'AI_REMOTION_PROGRAM_V1';
  media: Array<{ id: string; url: string; fileName: string; isCover: boolean }>;
  plan: AiVideoPlan;
  code: string;
  codeHash: string;
  model: string;
  attempts: Array<{ model: string; error: string | null }>;
  facts: {
    title: string; referenceCode: string | null; location: string | null; priceLabel: string | null;
    roomCount: string | null; areaLabel: string | null; features: string[]; companyName: string;
    companyLogoUrl: string | null; advisorName: string; advisorPhone: string | null;
    assets: Array<{ assetId: string; url: string }>;
  };
};

export async function createAiBrowserVideoJob(input: {
  actor: StudioVideoActor;
  portfolio: PortfolioVideoPortfolio;
  mediaIds: string[];
  command: string;
  format: AiVideoFormat;
  durationSeconds: AiVideoDuration;
  plan: AiVideoPlan;
  code: string;
  codeHash: string;
  model: string;
  attempts: Array<{ model: string; error: string | null }>;
  idempotencyKey: string;
}, client: Client = prisma) {
  const plan = aiVideoPlanSchema.parse(input.plan);
  const mediaIds = [...new Set(input.mediaIds)];
  const property = await client.crmProperty.findFirst({
    where: { id: input.portfolio.id, companyAccountId: input.actor.companyAccountId, status: { in: ['DRAFT', 'ACTIVE', 'RESERVED'] } },
    include: { media: { where: { id: { in: mediaIds }, companyAccountId: input.actor.companyAccountId, archivedAt: null, mediaType: 'PHOTO', usageRightsStatus: { not: 'RESTRICTED' } }, select: { id: true, url: true, fileName: true, isCover: true } } },
  });
  if (!property) throw new StudioVideoJobError('Portföy bulunamadı veya bu şirkete ait değil.', 404, 'PROPERTY_NOT_FOUND');
  if (property.media.length !== mediaIds.length) throw new StudioVideoJobError('Seçilen görsellerden biri bu şirkete ait değil.', 403, 'MEDIA_FORBIDDEN');
  const byId = new Map(property.media.map((media) => [media.id, media]));
  const media = mediaIds.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const assetIds = new Set(mediaIds);
  if (plan.scenes.some((scene) => scene.assetIds.some((id) => !assetIds.has(id)))) throw new StudioVideoJobError('Video planı izin verilmeyen bir görsel içeriyor.', 403, 'MEDIA_FORBIDDEN');
  const snapshot: AiBrowserSnapshot = {
    kind: 'AI_REMOTION_PROGRAM_V1', media, plan, code: input.code, codeHash: input.codeHash, model: input.model, attempts: input.attempts,
    facts: {
      title: input.portfolio.title, referenceCode: input.portfolio.referenceCode, location: input.portfolio.location,
      priceLabel: input.portfolio.price == null ? null : `${new Intl.NumberFormat('tr-TR').format(input.portfolio.price)} TL`,
      roomCount: input.portfolio.roomCount, areaLabel: input.portfolio.area == null ? null : `${new Intl.NumberFormat('tr-TR').format(input.portfolio.area)} m²`,
      features: input.portfolio.features, companyName: input.portfolio.company.name, companyLogoUrl: input.portfolio.company.logoUrl,
      advisorName: input.portfolio.advisor.name, advisorPhone: input.portfolio.advisor.phone,
      assets: media.map((item) => ({ assetId: item.id, url: item.url })),
    },
  };
  return client.studioVideoJob.upsert({
    where: { companyAccountId_idempotencyKey: { companyAccountId: input.actor.companyAccountId, idempotencyKey: input.idempotencyKey } },
    create: {
      companyAccountId: input.actor.companyAccountId, propertyId: property.id, createdByMemberId: input.actor.memberId,
      prompt: `AI Remotion · ${input.codeHash.slice(0, 12)}`, userCommand: input.command, referenceMediaIds: mediaIds,
      referenceSnapshot: snapshot as unknown as Prisma.InputJsonValue, provider: AI_BROWSER_PROVIDER, model: input.model,
      durationSeconds: input.durationSeconds, ratio: input.format, resolution: '1080p', generateAudio: false,
      status: 'QUEUED', progress: 0, idempotencyKey: input.idempotencyKey,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
    update: {},
  });
}

export function serializeAiBrowserJob(job: { id: string; propertyId: string; status: string; progress: number; durationSeconds: number; ratio: string; model: string; referenceSnapshot: unknown; createdAt: Date }) {
  const snapshot = job.referenceSnapshot as Partial<AiBrowserSnapshot> | null;
  if (!snapshot || snapshot.kind !== 'AI_REMOTION_PROGRAM_V1' || !snapshot.plan || !snapshot.facts || !snapshot.codeHash) throw new StudioVideoJobError('AI video kaydı okunamadı.', 500, 'INVALID_SNAPSHOT');
  return { id: job.id, propertyId: job.propertyId, status: job.status, progress: job.progress, durationSeconds: job.durationSeconds, format: job.ratio, model: job.model, plan: aiVideoPlanSchema.parse(snapshot.plan), codeHash: snapshot.codeHash, facts: snapshot.facts, createdAt: job.createdAt };
}

export async function getAiBrowserVideoJob(actor: StudioVideoActor, jobId: string, client: Client = prisma) {
  const job = await client.studioVideoJob.findFirst({
    where: {
      id: jobId,
      companyAccountId: actor.companyAccountId,
      provider: AI_BROWSER_PROVIDER,
      ...(actor.memberId ? { createdByMemberId: actor.memberId } : {}),
    },
  });
  if (!job) throw new StudioVideoJobError('AI video önizlemesi bulunamadı.', 404, 'JOB_NOT_FOUND');
  return serializeAiBrowserJob(job);
}
