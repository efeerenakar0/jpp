import { get } from "@vercel/blob";
import { requireFabrikaPrincipal } from "@/lib/fabrika-session";
import {
  getOwnedStudioVideoJob,
  StudioVideoJobError,
} from "@/lib/studio-video/jobs";
import {
  safeStudioVideoFileName,
  studioVideoActor,
  studioVideoHttpError,
  studioVideoJobParamsSchema,
} from "../../route-utils";

export const dynamic = "force-dynamic";

type ArtifactRouteContext = {
  params: Promise<{ jobId: string }>;
};

function artifactNotFound() {
  return new StudioVideoJobError(
    "Video çıktısı bulunamadı.",
    404,
    "ARTIFACT_NOT_FOUND",
  );
}

export async function GET(request: Request, context: ArtifactRouteContext) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { jobId } = studioVideoJobParamsSchema.parse(await context.params);
    const job = await getOwnedStudioVideoJob(
      studioVideoActor(principal),
      jobId,
    );
    if (job.status !== "COMPLETED" || !job.outputStorageKey) {
      throw artifactNotFound();
    }

    const requestedRange = request.headers.get("range");
    const range =
      requestedRange && /^bytes=\d*-\d*$/.test(requestedRange)
        ? requestedRange
        : null;
    const blob = await get(job.outputStorageKey, {
      access: "private",
      useCache: false,
      ...(range ? { headers: { Range: range } } : {}),
    });
    if (!blob || blob.statusCode !== 200) {
      throw artifactNotFound();
    }

    const contentRange = blob.headers.get("content-range");
    const contentLength =
      blob.headers.get("content-length") || String(blob.blob.size);
    return new Response(blob.stream, {
      status: contentRange ? 206 : 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": contentLength,
        "Content-Disposition": `inline; filename="${safeStudioVideoFileName(
          job.outputFileName,
          job.id,
        )}"`,
        "Accept-Ranges": "bytes",
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return studioVideoHttpError(error, "Video çıktısı indirilemedi.");
  }
}
