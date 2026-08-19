import { NextResponse } from "next/server";
import {
  cleanupExpiredStudioBatches,
  processNextStudioBatchItem,
} from "@/lib/studio-batches";
import {
  cleanupExpiredStudioVideoJobs,
  processNextStudioVideoJob,
} from "@/lib/studio-video/jobs";
import { processNextBannerbearPosterVideoJob } from "@/lib/bannerbear-poster-video-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

type WorkerResult =
  | ({ kind: "STUDIO" } & NonNullable<
      Awaited<ReturnType<typeof processNextStudioBatchItem>>
    >)
  | ({ kind: "STUDIO_VIDEO" } & NonNullable<
      Awaited<ReturnType<typeof processNextStudioVideoJob>>
    >)
  | ({ kind: "POSTER_VIDEO" } & NonNullable<
      Awaited<ReturnType<typeof processNextBannerbearPosterVideoJob>>
    >);

async function processNext(
  kind: WorkerResult["kind"],
): Promise<WorkerResult | null> {
  if (kind === "STUDIO") {
    const result = await processNextStudioBatchItem();
    return result ? { kind, ...result } : null;
  }
  if (kind === "POSTER_VIDEO") {
    const result = await processNextBannerbearPosterVideoJob();
    return result ? { kind, ...result } : null;
  }
  const result = await processNextStudioVideoJob();
  return result ? { kind, ...result } : null;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  const startedAt = Date.now();
  const [cleanedImages, cleanedVideos] = await Promise.all([
    cleanupExpiredStudioBatches().catch(() => 0),
    cleanupExpiredStudioVideoJobs().catch(() => 0),
  ]);
  const results: WorkerResult[] = [];
  while (results.length < 3 && Date.now() - startedAt < 240_000) {
    const order: WorkerResult["kind"][] = results.length % 3 === 0
      ? ["STUDIO", "POSTER_VIDEO", "STUDIO_VIDEO"]
      : results.length % 3 === 1
        ? ["POSTER_VIDEO", "STUDIO_VIDEO", "STUDIO"]
        : ["STUDIO_VIDEO", "STUDIO", "POSTER_VIDEO"];
    let result: WorkerResult | null = null;
    for (const kind of order) {
      result = await processNext(kind);
      if (result) break;
    }
    if (!result) break;
    results.push(result);
  }
  return NextResponse.json({
    success: true,
    processed: results.length,
    cleaned: cleanedImages,
    cleanedImages,
    cleanedVideos,
    results,
  });
}
