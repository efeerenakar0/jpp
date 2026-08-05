import { describe, expect, it } from "vitest";
import {
  buildStudioVideoPrompt,
  studioVideoProgress,
  studioVideoRetryDelayMs,
} from "./job-rules";

describe("Studio video iş kuralları", () => {
  it("kullanıcı talimatını yalnız doğrulanmış portföy gerçekleriyle birleştirir", () => {
    const prompt = buildStudioVideoPrompt({
      command:
        "İlk karede havuz görünsün, sonra salon canlansın; lüks ve sinematik olsun.",
      property: {
        title: "Kestel Deniz Villası",
        location: "Alanya / Kestel",
        price: 18_500_000,
        roomCount: "4+1",
        area: 280,
        description: "Deniz manzaralı, özel havuzlu müstakil villa.",
      },
    });

    expect(prompt).toContain("Kestel Deniz Villası");
    expect(prompt).toContain("Alanya / Kestel");
    expect(prompt).toContain("4+1");
    expect(prompt).toContain("280 m²");
    expect(prompt).toContain("İlk karede havuz görünsün");
    expect(prompt).toContain("Use only verified elements visible");
  });

  it("eksik portföy alanlarını uydurmaz ve uzun açıklamayı sınırlar", () => {
    const prompt = buildStudioVideoPrompt({
      command: "Doğal bir kamera hareketi oluştur.",
      property: {
        title: "Özel Portföy",
        location: null,
        price: null,
        roomCount: null,
        area: null,
        description: "a".repeat(2_000),
      },
    });

    expect(prompt).not.toContain("Location:");
    expect(prompt).not.toContain("Price:");
    expect(prompt.length).toBeLessThan(2_000);
  });

  it("duruma göre monoton ve anlaşılır ilerleme üretir", () => {
    expect(studioVideoProgress("QUEUED")).toBe(5);
    expect(studioVideoProgress("SUBMITTING")).toBe(15);
    expect(studioVideoProgress("GENERATING")).toBe(55);
    expect(studioVideoProgress("PERSISTING")).toBe(90);
    expect(studioVideoProgress("COMPLETED")).toBe(100);
    expect(studioVideoProgress("FAILED")).toBe(100);
  });

  it("geçici sağlayıcı hatalarında sınırlı üstel geri çekilme uygular", () => {
    expect(studioVideoRetryDelayMs(1)).toBe(30_000);
    expect(studioVideoRetryDelayMs(2)).toBe(60_000);
    expect(studioVideoRetryDelayMs(10)).toBe(300_000);
  });
});
