import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  StudioVideoArtifactError,
  persistStudioVideoArtifact,
} from "./artifact-storage";

describe("Studio video artefakt saklama", () => {
  it("sağlayıcı MP4 çıktısını özel ve tenant ayrımlı depoya kopyalar", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": "4",
          },
        }),
    );
    const putter = vi.fn(
      async (pathname: string, body: ReadableStream<Uint8Array>) => {
        const bytes = await new Response(body).arrayBuffer();
        expect(bytes.byteLength).toBe(4);
        return { pathname, url: `https://private.example/${pathname}` };
      },
    );

    const result = await persistStudioVideoArtifact(
      {
        companyAccountId: "company/one",
        jobId: "job:123",
        sourceUrl: "https://provider.example/video.mp4",
      },
      { fetcher: fetcher as typeof fetch, putter },
    );

    expect(putter).toHaveBeenCalledWith(
      "studio-video/company_one/job_123/output.mp4",
      expect.any(ReadableStream),
      expect.objectContaining({ access: "private", contentType: "video/mp4" }),
    );
    expect(result).toEqual({
      storageKey: "studio-video/company_one/job_123/output.mp4",
      fileName: "portfoy-ai-video.mp4",
      mimeType: "video/mp4",
      byteSize: 4,
    });
  });

  it("video olmayan veya aşırı büyük sağlayıcı çıktısını reddeder", async () => {
    const invalidFetcher = vi.fn(
      async () =>
        new Response("html", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    );

    await expect(
      persistStudioVideoArtifact(
        {
          companyAccountId: "company",
          jobId: "job",
          sourceUrl: "https://provider.example/result",
        },
        { fetcher: invalidFetcher as typeof fetch, putter: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(StudioVideoArtifactError);
  });
});
