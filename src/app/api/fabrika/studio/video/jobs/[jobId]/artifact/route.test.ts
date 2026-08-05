import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  class SessionError extends Error {}
  class ForbiddenError extends Error {}
  class JobError extends Error {
    constructor(
      message: string,
      public status = 400,
      public code = "INVALID_REQUEST",
    ) {
      super(message);
    }
  }
  return {
    SessionError,
    ForbiddenError,
    JobError,
    requirePrincipal: vi.fn(),
    getJob: vi.fn(),
    getBlob: vi.fn(),
  };
});

vi.mock("@/lib/fabrika-session", () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock("@/lib/studio-video/jobs", () => ({
  StudioVideoJobError: mocks.JobError,
  getOwnedStudioVideoJob: mocks.getJob,
}));

vi.mock("@vercel/blob", () => ({ get: mocks.getBlob }));

import { GET } from "./route";

describe("/api/fabrika/studio/video/jobs/[jobId]/artifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({
      account: { id: "company-a" },
      type: "EMPLOYEE",
      member: { id: "member-a" },
    });
    mocks.getJob.mockResolvedValue({
      id: "job-a",
      status: "COMPLETED",
      outputStorageKey: "studio-video/company-a/job-a/output.mp4",
      outputFileName: "portfolio\r\nunsafe.mp4",
      outputMimeType: "video/mp4",
      outputByteSize: 3,
    });
    mocks.getBlob.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
      headers: new Headers(),
      blob: {
        size: 3,
        contentType: "video/mp4",
      },
    });
  });

  it("tenant-checks the job before privately streaming its blob", async () => {
    const response = await GET(new Request("https://app.test/unused"), {
      params: Promise.resolve({ jobId: "job-a" }),
    } as never);

    expect(mocks.getJob).toHaveBeenCalledWith(
      { companyAccountId: "company-a", memberId: "member-a" },
      "job-a",
    );
    expect(mocks.getBlob).toHaveBeenCalledWith(
      "studio-video/company-a/job-a/output.mp4",
      { access: "private", useCache: false },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("3");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="portfolio_unsafe.mp4"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("forwards a valid byte range so the private video can be scrubbed in a player", async () => {
    mocks.getBlob.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([2, 3]));
          controller.close();
        },
      }),
      headers: new Headers({
        "content-range": "bytes 1-2/3",
        "content-length": "2",
      }),
      blob: { size: 2, contentType: "video/mp4" },
    });

    const response = await GET(
      new Request("https://app.test/unused", {
        headers: { Range: "bytes=1-2" },
      }),
      { params: Promise.resolve({ jobId: "job-a" }) } as never,
    );

    expect(mocks.getBlob).toHaveBeenCalledWith(
      "studio-video/company-a/job-a/output.mp4",
      {
        access: "private",
        useCache: false,
        headers: { Range: "bytes=1-2" },
      },
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 1-2/3");
    expect(response.headers.get("content-length")).toBe("2");
  });

  it("does not call blob storage for a non-completed job", async () => {
    mocks.getJob.mockResolvedValue({
      id: "job-a",
      status: "GENERATING",
      outputStorageKey: null,
    });

    const response = await GET(new Request("https://app.test/unused"), {
      params: Promise.resolve({ jobId: "job-a" }),
    } as never);

    expect(response.status).toBe(404);
    expect(mocks.getBlob).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(
      "outputStorageKey",
    );
  });

  it("does not access blob storage when the tenant-scoped job lookup fails", async () => {
    mocks.getJob.mockRejectedValue(
      new mocks.JobError("Video işi bulunamadı.", 404, "JOB_NOT_FOUND"),
    );

    const response = await GET(new Request("https://app.test/unused"), {
      params: Promise.resolve({ jobId: "job-other-tenant" }),
    } as never);

    expect(response.status).toBe(404);
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  it("returns not found when the private blob is absent without leaking its key", async () => {
    mocks.getBlob.mockResolvedValue(null);

    const response = await GET(new Request("https://app.test/unused"), {
      params: Promise.resolve({ jobId: "job-a" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(JSON.stringify(body)).not.toContain("studio-video/company-a");
  });
});
