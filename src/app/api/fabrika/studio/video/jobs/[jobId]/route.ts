import { NextResponse } from "next/server";
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
