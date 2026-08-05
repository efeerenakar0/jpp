import "server-only";

import { z } from "zod";

export type StudioVideoProviderStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface SubmitStudioVideoInput {
  prompt: string;
  referenceImageUrls: string[];
  durationSeconds: number;
  ratio: "9:16" | "16:9" | "1:1" | "adaptive";
  resolution: "480p" | "720p" | "1080p";
  generateAudio: boolean;
}

export interface StudioVideoProvider {
  submit(input: SubmitStudioVideoInput): Promise<{ providerTaskId: string }>;
  retrieve(providerTaskId: string): Promise<{
    providerTaskId: string;
    status: StudioVideoProviderStatus;
    outputUrl?: string;
  }>;
  cancel(providerTaskId: string): Promise<void>;
}

export class StudioVideoProviderConfigurationError extends Error {
  constructor() {
    super(
      "AI Sinematik Video hizmeti platform yöneticisi tarafından henüz yapılandırılmadı.",
    );
    this.name = "StudioVideoProviderConfigurationError";
  }
}

export class StudioVideoProviderError extends Error {
  readonly code:
    | "INVALID_INPUT"
    | "RATE_LIMITED"
    | "PROVIDER_UNAVAILABLE"
    | "INVALID_RESPONSE";

  constructor(code: StudioVideoProviderError["code"], message: string) {
    super(message);
    this.name = "StudioVideoProviderError";
    this.code = code;
  }
}

const submitSchema = z
  .object({
    prompt: z.string().trim().min(10).max(4_000),
    referenceImageUrls: z
      .array(
        z
          .string()
          .url()
          .refine((url) => url.startsWith("https://")),
      )
      .min(1)
      .max(9),
    durationSeconds: z.number().int().min(4).max(15),
    ratio: z.enum(["9:16", "16:9", "1:1", "adaptive"]),
    resolution: z.enum(["480p", "720p", "1080p"]),
    generateAudio: z.boolean(),
  })
  .strict();

const taskIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/);

const createResponseSchema = z.object({ id: z.string().min(1) }).passthrough();
const retrieveResponseSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    content: z
      .object({
        video_url: z.string().url().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const SAFE_VIDEO_INSTRUCTION =
  "Create a premium real-estate motion video using only the supplied property references. Preserve the building, rooms, furniture and architecture. Do not invent people, logos, written claims, prices, addresses or property features. If the creative direction explicitly requests an on-screen caption, render only the exact supplied text or a verified property fact; never invent additional copy.";

type Fetcher = typeof fetch;

export interface BytePlusStudioVideoProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetcher?: Fetcher;
}

export class BytePlusStudioVideoProvider implements StudioVideoProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(options: BytePlusStudioVideoProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.baseUrl = (
      options.baseUrl || "https://ark.ap-southeast.bytepluses.com/api/v3"
    ).replace(/\/$/, "");
    this.fetcher = options.fetcher || fetch;
  }

  private configured() {
    if (!this.apiKey || !this.model || !this.baseUrl.startsWith("https://")) {
      throw new StudioVideoProviderConfigurationError();
    }
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async checkedResponse(response: Response) {
    if (response.ok) return;
    if (response.status === 429) {
      throw new StudioVideoProviderError(
        "RATE_LIMITED",
        "Video üretim servisi şu anda yoğun. İşiniz kısa süre sonra yeniden denenecek.",
      );
    }
    throw new StudioVideoProviderError(
      "PROVIDER_UNAVAILABLE",
      "Video üretim servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.",
    );
  }

  async submit(input: SubmitStudioVideoInput) {
    this.configured();
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioVideoProviderError(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Video isteği geçersiz.",
      );
    }

    const response = await this.fetcher(
      `${this.baseUrl}/contents/generations/tasks`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          content: [
            {
              type: "text",
              text: `${SAFE_VIDEO_INSTRUCTION}\n\nCreative direction from the user:\n${parsed.data.prompt}`,
            },
            ...parsed.data.referenceImageUrls.map((url) => ({
              type: "image_url",
              image_url: { url },
              role: "reference_image",
            })),
          ],
          generate_audio: parsed.data.generateAudio,
          ratio: parsed.data.ratio,
          resolution: parsed.data.resolution,
          duration: parsed.data.durationSeconds,
          watermark: true,
        }),
      },
    );
    await this.checkedResponse(response);
    const payload = createResponseSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new StudioVideoProviderError(
        "INVALID_RESPONSE",
        "Video servisi geçerli bir görev kimliği döndürmedi.",
      );
    }
    return { providerTaskId: payload.data.id };
  }

  async retrieve(providerTaskId: string) {
    this.configured();
    const taskId = taskIdSchema.safeParse(providerTaskId);
    if (!taskId.success) {
      throw new StudioVideoProviderError(
        "INVALID_INPUT",
        "Video görev kimliği geçersiz.",
      );
    }
    const response = await this.fetcher(
      `${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId.data)}`,
      { method: "GET", headers: this.headers() },
    );
    await this.checkedResponse(response);
    const payload = retrieveResponseSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new StudioVideoProviderError(
        "INVALID_RESPONSE",
        "Video servisi geçerli bir görev durumu döndürmedi.",
      );
    }

    const status = providerStatus(payload.data.status);
    return {
      providerTaskId: payload.data.id,
      status,
      ...(status === "SUCCEEDED" && payload.data.content?.video_url
        ? { outputUrl: payload.data.content.video_url }
        : {}),
    };
  }

  async cancel(providerTaskId: string) {
    this.configured();
    const taskId = taskIdSchema.safeParse(providerTaskId);
    if (!taskId.success) {
      throw new StudioVideoProviderError(
        "INVALID_INPUT",
        "Video görev kimliği geçersiz.",
      );
    }
    const response = await this.fetcher(
      `${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId.data)}`,
      { method: "DELETE", headers: this.headers() },
    );
    await this.checkedResponse(response);
  }
}

function providerStatus(value: string): StudioVideoProviderStatus {
  switch (value.toLowerCase()) {
    case "queued":
      return "QUEUED";
    case "running":
      return "RUNNING";
    case "succeeded":
      return "SUCCEEDED";
    case "failed":
      return "FAILED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    default:
      throw new StudioVideoProviderError(
        "INVALID_RESPONSE",
        "Video servisi bilinmeyen bir görev durumu döndürdü.",
      );
  }
}

export function configuredStudioVideoProvider() {
  return new BytePlusStudioVideoProvider({
    apiKey: process.env.BYTEPLUS_ARK_API_KEY || "",
    model:
      process.env.BYTEPLUS_SEEDANCE_MODEL || "dreamina-seedance-2-0-260128",
    baseUrl: process.env.BYTEPLUS_ARK_BASE_URL,
  });
}
