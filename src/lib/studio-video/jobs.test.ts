import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  propertyFindFirst: vi.fn(),
  jobFindFirst: vi.fn(),
  jobFindMany: vi.fn(),
  jobFindUnique: vi.fn(),
  jobCreate: vi.fn(),
  jobUpsert: vi.fn(),
  jobUpdateMany: vi.fn(),
  operationEventUpsert: vi.fn(),
  persistArtifact: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    crmProperty: { findFirst: mocks.propertyFindFirst },
    studioVideoJob: {
      findFirst: mocks.jobFindFirst,
      findMany: mocks.jobFindMany,
      findUnique: mocks.jobFindUnique,
      create: mocks.jobCreate,
      upsert: mocks.jobUpsert,
      updateMany: mocks.jobUpdateMany,
    },
    operationEvent: { upsert: mocks.operationEventUpsert },
  },
}));

vi.mock("./artifact-storage", () => ({
  persistStudioVideoArtifact: mocks.persistArtifact,
}));

vi.mock("./prompt-director", () => ({
  directStudioVideoCommand: vi.fn(
    async ({ command }: { command: string }) =>
      `Directed in English: ${command}`,
  ),
}));

import {
  cancelStudioVideoJob,
  createStudioVideoJob,
  processNextStudioVideoJob,
} from "./jobs";

const now = new Date("2026-08-04T12:00:00.000Z");

function propertyFixture() {
  return {
    id: "property-a",
    title: "Deniz manzaralı villa",
    location: "Alanya / Kestel",
    price: 12_500_000,
    roomCount: "4+1",
    area: 240,
    description: "Geniş teraslı doğrulanmış portföy.",
    media: [
      {
        id: "media-a",
        url: "https://assets.example.com/villa.jpg",
        fileName: "villa.jpg",
        isCover: true,
      },
    ],
  };
}

function queuedJob() {
  return {
    id: "video-job-a",
    companyAccountId: "company-a",
    propertyId: "property-a",
    createdByMemberId: "member-a",
    prompt: "Doğrulanmış portföy promptu",
    userCommand: "Lüks ve sinematik yap",
    referenceMediaIds: ["media-a"],
    referenceSnapshot: [
      {
        id: "media-a",
        url: "https://assets.example.com/villa.jpg",
        fileName: "villa.jpg",
        isCover: true,
      },
    ],
    provider: "BYTEPLUS",
    model: "seedance-model",
    providerTaskId: null,
    providerOutputUrl: null,
    durationSeconds: 10,
    ratio: "9:16",
    resolution: "720p",
    generateAudio: false,
    status: "QUEUED",
    progress: 5,
    idempotencyKey: "idem-a",
    attemptCount: 0,
    nextAttemptAt: now,
    leaseOwner: null,
    leaseExpiresAt: null,
    outputStorageKey: null,
    outputFileName: null,
    outputMimeType: null,
    outputByteSize: null,
    errorCode: null,
    errorMessage: null,
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  } as const;
}

describe("Studio AI video jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.propertyFindFirst.mockResolvedValue(propertyFixture());
    mocks.jobFindUnique.mockResolvedValue(null);
    mocks.jobCreate.mockImplementation(async ({ data }) => ({
      ...queuedJob(),
      ...data,
      id: "video-job-a",
      createdAt: now,
      updatedAt: now,
    }));
    mocks.jobUpsert.mockImplementation(async ({ create }) => ({
      ...queuedJob(),
      ...create,
      id: "video-job-a",
      createdAt: now,
      updatedAt: now,
    }));
    mocks.jobUpdateMany.mockResolvedValue({ count: 1 });
    mocks.operationEventUpsert.mockResolvedValue({ id: "event-a" });
  });

  it("scopes the property and every reference photo to the signed-in company", async () => {
    await createStudioVideoJob({
      actor: { companyAccountId: "company-a", memberId: "member-a" },
      propertyId: "property-a",
      mediaIds: ["media-a"],
      command: "Lüks ve sinematik yap",
      idempotencyKey: "idem-a",
      now,
    });

    expect(mocks.propertyFindFirst).toHaveBeenCalledWith({
      where: {
        id: "property-a",
        companyAccountId: "company-a",
        status: { in: ["DRAFT", "ACTIVE", "RESERVED"] },
      },
      include: {
        media: {
          where: {
            id: { in: ["media-a"] },
            companyAccountId: "company-a",
            archivedAt: null,
            mediaType: "PHOTO",
            usageRightsStatus: { not: "RESTRICTED" },
          },
          select: { id: true, url: true, fileName: true, isCover: true },
        },
      },
    });
    expect(mocks.jobUpsert).toHaveBeenCalledWith({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: "company-a",
          idempotencyKey: "idem-a",
        },
      },
      create: expect.objectContaining({
        companyAccountId: "company-a",
        propertyId: "property-a",
        createdByMemberId: "member-a",
        idempotencyKey: "idem-a",
      }),
      update: {},
    });
  });

  it("rejects a missing or foreign reference photo before creating a job", async () => {
    mocks.propertyFindFirst.mockResolvedValue({
      ...propertyFixture(),
      media: [],
    });

    await expect(
      createStudioVideoJob({
        actor: { companyAccountId: "company-a", memberId: "member-a" },
        propertyId: "property-a",
        mediaIds: ["foreign-media"],
        command: "Ailelere hitap eden sıcak bir video yap",
        idempotencyKey: "idem-foreign",
        now,
      }),
    ).rejects.toMatchObject({ code: "MEDIA_FORBIDDEN", status: 403 });

    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });

  it.each([
    "http://assets.example.com/villa.jpg",
    "https://localhost/villa.jpg",
    "https://127.0.0.1/villa.jpg",
    "not-a-url",
  ])(
    "rejects a reference photo that is not available on a public HTTPS URL: %s",
    async (url) => {
      mocks.propertyFindFirst.mockResolvedValue({
        ...propertyFixture(),
        media: [{ ...propertyFixture().media[0], url }],
      });

      await expect(
        createStudioVideoJob({
          actor: { companyAccountId: "company-a", memberId: "member-a" },
          propertyId: "property-a",
          mediaIds: ["media-a"],
          command: "Doğal bir tanıtım videosu yap",
          idempotencyKey: `invalid-url-${url}`,
          now,
        }),
      ).rejects.toMatchObject({ code: "MEDIA_NOT_PUBLIC", status: 422 });

      expect(mocks.jobUpsert).not.toHaveBeenCalled();
    },
  );

  it("returns the existing tenant job for the same idempotency key", async () => {
    const existing = queuedJob();
    mocks.jobFindUnique.mockResolvedValue(existing);

    const result = await createStudioVideoJob({
      actor: { companyAccountId: "company-a", memberId: "member-a" },
      propertyId: "property-a",
      mediaIds: ["media-a"],
      command: "Dikkat çekici yap",
      idempotencyKey: "idem-a",
      now,
    });

    expect(result).toBe(existing);
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });

  it("uses an atomic tenant-scoped upsert when concurrent requests share an idempotency key", async () => {
    const [first, second] = await Promise.all([
      createStudioVideoJob({
        actor: { companyAccountId: "company-a", memberId: "member-a" },
        propertyId: "property-a",
        mediaIds: ["media-a"],
        command: "Dikkat çekici yap",
        idempotencyKey: "idem-concurrent",
        now,
      }),
      createStudioVideoJob({
        actor: { companyAccountId: "company-a", memberId: "member-a" },
        propertyId: "property-a",
        mediaIds: ["media-a"],
        command: "Dikkat çekici yap",
        idempotencyKey: "idem-concurrent",
        now,
      }),
    ]);

    expect(first.id).toBe("video-job-a");
    expect(second.id).toBe("video-job-a");
    expect(mocks.jobUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.jobUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: "company-a",
            idempotencyKey: "idem-concurrent",
          },
        },
        update: {},
      }),
    );
  });

  it("submits a queued job only after winning the compare-and-set lease", async () => {
    mocks.jobFindFirst.mockResolvedValue(queuedJob());
    const provider = {
      submit: vi.fn().mockResolvedValue({ providerTaskId: "provider-task-a" }),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    };

    const result = await processNextStudioVideoJob({
      now,
      workerId: "worker-a",
      provider,
    });

    expect(mocks.jobUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: "video-job-a", status: "QUEUED" }),
        data: expect.objectContaining({ leaseOwner: "worker-a" }),
      }),
    );
    expect(provider.submit).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, status: "GENERATING" });
  });

  it("does not submit when another worker wins the lease", async () => {
    mocks.jobFindFirst.mockResolvedValue(queuedJob());
    mocks.jobUpdateMany.mockResolvedValueOnce({ count: 0 });
    const provider = {
      submit: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn(),
    };

    const result = await processNextStudioVideoJob({
      now,
      workerId: "worker-lost",
      provider,
    });

    expect(result).toBeNull();
    expect(provider.submit).not.toHaveBeenCalled();
  });

  it("does not persist a late provider result after the job was cancelled", async () => {
    mocks.jobFindFirst.mockResolvedValue({
      ...queuedJob(),
      status: "GENERATING",
      providerTaskId: "provider-task-a",
    });
    mocks.jobUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.jobFindUnique.mockResolvedValue({
      ...queuedJob(),
      status: "CANCELLED",
      providerTaskId: "provider-task-a",
    });
    const provider = {
      submit: vi.fn(),
      retrieve: vi.fn().mockResolvedValue({
        providerTaskId: "provider-task-a",
        status: "SUCCEEDED",
        outputUrl: "https://provider.example/video.mp4",
      }),
      cancel: vi.fn(),
    };
    const persistArtifact = vi.fn();

    const result = await processNextStudioVideoJob({
      now,
      workerId: "worker-a",
      provider,
      persistArtifact,
    });

    expect(result).toMatchObject({ ok: true, status: "CANCELLED" });
    expect(persistArtifact).not.toHaveBeenCalled();
  });

  it("persists a successful provider result once and marks it completed", async () => {
    const generating = {
      ...queuedJob(),
      status: "GENERATING" as const,
      progress: 55,
      providerTaskId: "provider-task-a",
      submittedAt: now,
    };
    const completed = {
      ...generating,
      status: "COMPLETED" as const,
      progress: 100,
      outputStorageKey: "studio-video/company-a/video-job-a/output.mp4",
      outputFileName: "portfoy-ai-video.mp4",
      outputMimeType: "video/mp4",
      outputByteSize: 1_024,
      completedAt: now,
    };
    mocks.jobFindFirst.mockResolvedValue(generating);
    mocks.jobFindUnique
      .mockResolvedValueOnce({
        ...generating,
        status: "PERSISTING",
        providerOutputUrl: "https://provider.example.com/output.mp4",
        leaseOwner: "worker-a",
      })
      .mockResolvedValueOnce(completed);
    mocks.persistArtifact.mockResolvedValue({
      storageKey: completed.outputStorageKey,
      fileName: completed.outputFileName,
      mimeType: completed.outputMimeType,
      byteSize: completed.outputByteSize,
    });
    const provider = {
      submit: vi.fn(),
      retrieve: vi.fn().mockResolvedValue({
        providerTaskId: "provider-task-a",
        status: "SUCCEEDED" as const,
        outputUrl: "https://provider.example.com/output.mp4",
      }),
      cancel: vi.fn(),
    };

    const result = await processNextStudioVideoJob({
      now,
      workerId: "worker-a",
      provider,
    });

    expect(mocks.persistArtifact).toHaveBeenCalledTimes(1);
    expect(mocks.persistArtifact).toHaveBeenCalledWith({
      companyAccountId: "company-a",
      jobId: "video-job-a",
      sourceUrl: "https://provider.example.com/output.mp4",
    });
    expect(mocks.operationEventUpsert).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, status: "COMPLETED" });
  });

  it("keeps cancellation locally authoritative when provider cancellation fails", async () => {
    const active = {
      ...queuedJob(),
      status: "GENERATING" as const,
      providerTaskId: "provider-task-a",
    };
    const cancelled = {
      ...active,
      status: "CANCELLED" as const,
      progress: 100,
      cancelledAt: now,
    };
    mocks.jobFindFirst
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(cancelled);
    const provider = {
      submit: vi.fn(),
      retrieve: vi.fn(),
      cancel: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };

    const result = await cancelStudioVideoJob(
      { companyAccountId: "company-a", memberId: "member-a" },
      "video-job-a",
      { provider, now },
    );

    expect(mocks.jobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "video-job-a",
        companyAccountId: "company-a",
        status: { in: ["QUEUED", "SUBMITTING", "GENERATING", "PERSISTING"] },
      },
      data: expect.objectContaining({
        status: "CANCELLED",
        progress: 100,
        cancelledAt: now,
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      }),
    });
    expect(provider.cancel).toHaveBeenCalledWith("provider-task-a");
    expect(mocks.jobUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      provider.cancel.mock.invocationCallOrder[0],
    );
    expect(result).toBe(cancelled);
  });
});
