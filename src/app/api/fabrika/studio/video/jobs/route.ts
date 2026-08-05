import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFabrikaPrincipal } from "@/lib/fabrika-session";
import {
  createStudioVideoJob,
  listStudioVideoJobs,
  serializeStudioVideoJob,
  StudioVideoJobError,
} from "@/lib/studio-video/jobs";
import {
  studioVideoActor,
  studioVideoHttpError,
  studioVideoReadiness,
} from "./route-utils";

const createStudioVideoJobSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(200),
    mediaIds: z.array(z.string().trim().min(1).max(200)).min(1).max(9),
    command: z.string().trim().min(3).max(1_000),
    durationSeconds: z.number().int().min(4).max(15).optional(),
    ratio: z.enum(["9:16", "16:9", "1:1"]).optional(),
    resolution: z.enum(["720p", "1080p"]).optional(),
    generateAudio: z.boolean().optional(),
    idempotencyKey: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const jobs = await listStudioVideoJobs(studioVideoActor(principal));
    return NextResponse.json({
      ...studioVideoReadiness(),
      jobs: jobs.map(serializeStudioVideoJob),
    });
  } catch (error) {
    return studioVideoHttpError(error, "Video işleri alınamadı.");
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const input = createStudioVideoJobSchema.parse(await request.json());
    if (!studioVideoReadiness().configured) {
      throw new StudioVideoJobError(
        "AI Sinematik Video hizmeti platform yöneticisi tarafından henüz yapılandırılmadı.",
        503,
        "NOT_CONFIGURED",
      );
    }
    const job = await createStudioVideoJob({
      actor: studioVideoActor(principal),
      ...input,
    });
    return NextResponse.json(
      { job: serializeStudioVideoJob(job) },
      { status: 201 },
    );
  } catch (error) {
    return studioVideoHttpError(error, "Video işi oluşturulamadı.");
  }
}
