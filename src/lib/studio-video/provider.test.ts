import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BytePlusStudioVideoProvider,
  StudioVideoProviderConfigurationError,
} from "./provider";

function mockFetch(responseFactory: () => Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return responseFactory();
  });
}

describe("BytePlus Studio video provider", () => {
  it("serbest promptu ve en fazla dokuz portföy görselini gerçek video görevine taşır", async () => {
    const fetcher = mockFetch(
      () =>
        new Response(JSON.stringify({ id: "task-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const provider = new BytePlusStudioVideoProvider({
      apiKey: "server-secret",
      model: "dreamina-seedance-2-0-test",
      fetcher: fetcher as typeof fetch,
    });

    const result = await provider.submit({
      prompt:
        "İlk kareden sonra fiyat zarifçe belirsin, ardından havuz ve salon görüntülerine geç.",
      referenceImageUrls: [
        "https://private.example.com/property/hero.jpg",
        "https://private.example.com/property/pool.jpg",
      ],
      durationSeconds: 10,
      ratio: "9:16",
      resolution: "720p",
      generateAudio: false,
    });

    expect(result).toEqual({ providerTaskId: "task-123" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
    );
    expect(init?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer server-secret" }),
    );
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(
      expect.objectContaining({
        model: "dreamina-seedance-2-0-test",
        duration: 10,
        ratio: "9:16",
        resolution: "720p",
        watermark: true,
      }),
    );
    expect(body.content).toEqual([
      expect.objectContaining({ type: "text" }),
      {
        type: "image_url",
        image_url: { url: "https://private.example.com/property/hero.jpg" },
        role: "reference_image",
      },
      {
        type: "image_url",
        image_url: { url: "https://private.example.com/property/pool.jpg" },
        role: "reference_image",
      },
    ]);
    const providerPrompt = String(body.content[0]?.text);
    expect(providerPrompt).toContain(
      "If the creative direction explicitly requests an on-screen caption, render only the exact supplied text or a verified property fact",
    );
    expect(providerPrompt).toContain("Do not invent people, logos");
    expect(providerPrompt).not.toContain("text overlays are added later");
  });

  it("platform anahtarı yoksa dış isteğe çıkmadan kapalı kalır", async () => {
    const fetcher = mockFetch(() => new Response("{}", { status: 200 }));
    const provider = new BytePlusStudioVideoProvider({
      apiKey: "",
      model: "dreamina-seedance-2-0-test",
      fetcher: fetcher as typeof fetch,
    });

    await expect(
      provider.submit({
        prompt: "Sinematik bir havuz geçişi oluştur.",
        referenceImageUrls: ["https://private.example.com/property/hero.jpg"],
        durationSeconds: 5,
        ratio: "9:16",
        resolution: "720p",
        generateAudio: false,
      }),
    ).rejects.toBeInstanceOf(StudioVideoProviderConfigurationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sağlayıcı durumlarını ortak ve kullanıcıdan bağımsız iş durumlarına çevirir", async () => {
    const fetcher = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            id: "task-123",
            status: "succeeded",
            content: { video_url: "https://outputs.example.com/video.mp4" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const provider = new BytePlusStudioVideoProvider({
      apiKey: "server-secret",
      model: "dreamina-seedance-2-0-test",
      fetcher: fetcher as typeof fetch,
    });

    await expect(provider.retrieve("task-123")).resolves.toEqual({
      status: "SUCCEEDED",
      outputUrl: "https://outputs.example.com/video.mp4",
      providerTaskId: "task-123",
    });
  });

  it("kuyruktaki görevi resmî DELETE uç noktasıyla iptal eder", async () => {
    const fetcher = mockFetch(() => new Response("{}", { status: 200 }));
    const provider = new BytePlusStudioVideoProvider({
      apiKey: "server-secret",
      model: "dreamina-seedance-2-0-test",
      fetcher: fetcher as typeof fetch,
    });

    await provider.cancel("task-123");
    expect(fetcher).toHaveBeenCalledWith(
      "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
