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
    createJob: vi.fn(),
    listJobs: vi.fn(),
    serializeJob: vi.fn((job: { id: string }) => ({ id: job.id })),
  };
});

vi.mock("@/lib/fabrika-session", () => ({
  FabrikaSessionError: mocks.SessionError,
  FabrikaForbiddenError: mocks.ForbiddenError,
  requireFabrikaPrincipal: mocks.requirePrincipal,
}));

vi.mock("@/lib/studio-video/jobs", () => ({
  StudioVideoJobError: mocks.JobError,
  createStudioVideoJob: mocks.createJob,
  listStudioVideoJobs: mocks.listJobs,
  serializeStudioVideoJob: mocks.serializeJob,
}));

import { GET, POST } from "./route";

function principal(type: "OWNER" | "EMPLOYEE") {
  return {
    account: { id: "company-a" },
    type,
    member: type === "EMPLOYEE" ? { id: "member-a" } : null,
  };
}

function createRequest(body: unknown) {
  return new Request("https://app.test/api/fabrika/studio/video/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/fabrika/studio/video/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.requirePrincipal.mockResolvedValue(principal("OWNER"));
    mocks.listJobs.mockResolvedValue([{ id: "job-a" }]);
    mocks.createJob.mockResolvedValue({ id: "job-created" });
  });

  it("lists tenant jobs for an owner and exposes readiness without provider secrets", async () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "platform-secret");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listJobs).toHaveBeenCalledWith({
      companyAccountId: "company-a",
      memberId: null,
    });
    expect(body).toEqual({
      configured: true,
      readiness: {
        managedByPlatform: true,
        ready: true,
        service: "Business CEO AI Sinematik Video",
      },
      jobs: [{ id: "job-a" }],
    });
    expect(JSON.stringify(body)).not.toContain("platform-secret");
  });

  it("reports an unconfigured platform when the API key is blank", async () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "   ");

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      configured: false,
      readiness: { ready: false },
    });
  });

  it("scopes an employee job list to that member", async () => {
    mocks.requirePrincipal.mockResolvedValue(principal("EMPLOYEE"));

    await GET();

    expect(mocks.listJobs).toHaveBeenCalledWith({
      companyAccountId: "company-a",
      memberId: "member-a",
    });
  });

  it("creates employee-owned jobs from a strict, validated request", async () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "platform-secret");
    mocks.requirePrincipal.mockResolvedValue(principal("EMPLOYEE"));
    const request = createRequest({
      propertyId: "property-a",
      mediaIds: ["media-a", "media-b"],
      command: "Create a calm cinematic tour",
      durationSeconds: 10,
      ratio: "16:9",
      resolution: "1080p",
      generateAudio: true,
      idempotencyKey: "create-video-1",
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createJob).toHaveBeenCalledWith({
      actor: { companyAccountId: "company-a", memberId: "member-a" },
      propertyId: "property-a",
      mediaIds: ["media-a", "media-b"],
      command: "Create a calm cinematic tour",
      durationSeconds: 10,
      ratio: "16:9",
      resolution: "1080p",
      generateAudio: true,
      idempotencyKey: "create-video-1",
    });
    await expect(response.json()).resolves.toEqual({
      job: { id: "job-created" },
    });
  });

  it("fails closed before creating a paid job when the platform provider is not configured", async () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "   ");

    const response = await POST(
      createRequest({
        propertyId: "property-a",
        mediaIds: ["media-a"],
        command: "Lüks ve sinematik bir video oluştur",
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.createJob).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });

  it("rejects unknown input fields before creating a job", async () => {
    const response = await POST(
      createRequest({
        propertyId: "property-a",
        mediaIds: ["media-a"],
        command: "Create a cinematic tour",
        providerApiKey: "must-not-be-accepted",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createJob).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(
      "must-not-be-accepted",
    );
  });

  it("rejects malformed JSON as a client error", async () => {
    const response = await POST(
      new Request("https://app.test/api/fabrika/studio/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("requires a Fabrika session", async () => {
    mocks.requirePrincipal.mockRejectedValue(
      new mocks.SessionError("no session"),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.listJobs).not.toHaveBeenCalled();
  });
});
