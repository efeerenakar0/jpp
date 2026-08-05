import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
} from "@/lib/fabrika-session";
import {
  StudioVideoJobError,
  type StudioVideoActor,
} from "@/lib/studio-video/jobs";

type PrincipalActorInput = {
  account: { id: string };
} & (
  | { type: "OWNER"; member: null }
  | { type: "EMPLOYEE"; member: { id: string } }
);

export const studioVideoJobParamsSchema = z
  .object({
    jobId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/),
  })
  .strict();

export function studioVideoActor(
  principal: PrincipalActorInput,
): StudioVideoActor {
  return {
    companyAccountId: principal.account.id,
    memberId: principal.type === "EMPLOYEE" ? principal.member.id : null,
  };
}

export function studioVideoHttpError(error: unknown, fallbackMessage: string) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof StudioVideoJobError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Video işi isteği geçersiz.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }
  console.error(
    "[Studio video API error]",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    { error: fallbackMessage, code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function studioVideoReadiness() {
  const ready = Boolean(process.env.BYTEPLUS_ARK_API_KEY?.trim());
  return {
    configured: ready,
    readiness: {
      managedByPlatform: true,
      ready,
      service: "Business CEO AI Sinematik Video",
    },
  };
}

export function safeStudioVideoFileName(value: string | null, jobId: string) {
  const fallback = `business-ceo-ai-video-${jobId}.mp4`;
  const safe = (value || fallback)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return safe || fallback;
}
