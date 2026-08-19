import { after, NextResponse } from "next/server";
import { requireFabrikaPrincipal } from "@/lib/fabrika-session";
import {
  cancelStudioVideoJob,
  getOwnedStudioVideoJob,
  serializeStudioVideoJob,
} from "@/lib/studio-video/jobs";
import {
  studioVideoActor,
  studioVideoHttpError,
  studioVideoJobParamsSchema,
} from "../route-utils";
import { processNextBannerbearPosterVideoJob } from "@/lib/bannerbear-poster-video-jobs";

type JobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobRouteContext) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { jobId } = studioVideoJobParamsSchema.parse(await context.params);
    const job = await getOwnedStudioVideoJob(
      studioVideoActor(principal),
      jobId,
    );
    if (
      job.provider === "BANNERBEAR" &&
      ["QUEUED", "SUBMITTING", "GENERATING", "PERSISTING"].includes(job.status)
    ) {
      after(() => processNextBannerbearPosterVideoJob({ jobId: job.id }));
    }
    return NextResponse.json({ job: serializeStudioVideoJob(job) });
  } catch (error) {
    return studioVideoHttpError(error, "Video işi alınamadı.");
  }
}

export async function DELETE(_request: Request, context: JobRouteContext) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { jobId } = studioVideoJobParamsSchema.parse(await context.params);
    const job = await cancelStudioVideoJob(studioVideoActor(principal), jobId);
    return NextResponse.json({ job: serializeStudioVideoJob(job) });
  } catch (error) {
    return studioVideoHttpError(error, "Video işi iptal edilemedi.");
  }
}
