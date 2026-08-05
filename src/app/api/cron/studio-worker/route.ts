import { NextResponse } from "next/server";
import {
  cleanupExpiredStudioBatches,
  processNextStudioBatchItem,
} from "@/lib/studio-batches";
import {
  cleanupExpiredStudioVideoJobs,
  processNextStudioVideoJob,
} from "@/lib/studio-video/jobs";

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
    >);

async function processNext(
  kind: WorkerResult["kind"],
): Promise<WorkerResult | null> {
  if (kind === "STUDIO") {
    const result = await processNextStudioBatchItem();
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
    const preferredKind = results.length % 2 === 0 ? "STUDIO" : "STUDIO_VIDEO";
    const fallbackKind = preferredKind === "STUDIO" ? "STUDIO_VIDEO" : "STUDIO";
    const result =
      (await processNext(preferredKind)) ?? (await processNext(fallbackKind));
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
