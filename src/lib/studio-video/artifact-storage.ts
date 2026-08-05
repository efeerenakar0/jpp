import "server-only";

import { put } from "@vercel/blob";

const STUDIO_VIDEO_MAX_BYTES = 250 * 1024 * 1024;

type VideoPutter = (
  pathname: string,
  body: ReadableStream<Uint8Array>,
  options: {
    access: "private";
    addRandomSuffix: false;
    allowOverwrite: true;
    contentType: string;
    multipart: true;
  },
) => Promise<{ pathname: string; url: string }>;

export class StudioVideoArtifactError extends Error {
  readonly code:
    | "INVALID_URL"
    | "DOWNLOAD_FAILED"
    | "INVALID_VIDEO"
    | "TOO_LARGE";

  constructor(code: StudioVideoArtifactError["code"], message: string) {
    super(message);
    this.name = "StudioVideoArtifactError";
    this.code = code;
  }
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "unknown";
}

function sizeLimitedStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
  onBytes: (size: number) => void,
) {
  const reader = source.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await reader.read();
      if (next.done) {
        onBytes(total);
        controller.close();
        return;
      }
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader
          .cancel("Studio video size limit exceeded")
          .catch(() => undefined);
        controller.error(
          new StudioVideoArtifactError(
            "TOO_LARGE",
            "Üretilen video 250 MB saklama sınırını aşıyor.",
          ),
        );
        return;
      }
      controller.enqueue(next.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function persistStudioVideoArtifact(
  input: {
    companyAccountId: string;
    jobId: string;
    sourceUrl: string;
  },
  dependencies: { fetcher?: typeof fetch; putter?: VideoPutter } = {},
) {
  let source: URL;
  try {
    source = new URL(input.sourceUrl);
  } catch {
    throw new StudioVideoArtifactError(
      "INVALID_URL",
      "Video çıktı adresi geçersiz.",
    );
  }
  if (source.protocol !== "https:") {
    throw new StudioVideoArtifactError(
      "INVALID_URL",
      "Video çıktı adresi güvenli HTTPS olmalıdır.",
    );
  }

  const response = await (dependencies.fetcher ?? fetch)(source, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
    headers: { Accept: "video/mp4,video/*;q=0.9" },
  });
  if (!response.ok || !response.body) {
    throw new StudioVideoArtifactError(
      "DOWNLOAD_FAILED",
      "Üretilen video sağlayıcıdan güvenli depoya alınamadı.",
    );
  }
  const mimeType = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (mimeType !== "video/mp4") {
    throw new StudioVideoArtifactError(
      "INVALID_VIDEO",
      "Video sağlayıcısı geçerli bir MP4 çıktısı döndürmedi.",
    );
  }
  const declaredSize = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredSize) && declaredSize > STUDIO_VIDEO_MAX_BYTES) {
    throw new StudioVideoArtifactError(
      "TOO_LARGE",
      "Üretilen video 250 MB saklama sınırını aşıyor.",
    );
  }

  let actualSize = 0;
  const stream = sizeLimitedStream(
    response.body,
    STUDIO_VIDEO_MAX_BYTES,
    (size) => {
      actualSize = size;
    },
  );
  const pathname = [
    "studio-video",
    safePathPart(input.companyAccountId),
    safePathPart(input.jobId),
    "output.mp4",
  ].join("/");
  const putter = dependencies.putter ?? (put as unknown as VideoPutter);
  const blob = await putter(pathname, stream, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
    multipart: true,
  });

  return {
    storageKey: blob.pathname || pathname,
    fileName: "portfoy-ai-video.mp4",
    mimeType: "video/mp4",
    byteSize: actualSize || declaredSize || null,
  };
}
