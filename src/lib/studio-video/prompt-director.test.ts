import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { directStudioVideoCommand } from "./prompt-director";

describe("directStudioVideoCommand", () => {
  it("turns a Turkish free-form instruction into a concise English shot direction", async () => {
    const generate = vi.fn().mockResolvedValue({
      content:
        "Open on [Image 1] with a slow dolly-in. Reveal the price with a clean cut, then move through [Image 2] and [Image 3].",
    });

    const result = await directStudioVideoCommand(
      {
        command:
          "İlk fotoğraftan sonra fiyat belirsin, sonra diğer portföy fotoğraflarına geç.",
        referenceCount: 3,
      },
      generate,
    );

    expect(result).toContain("[Image 1]");
    expect(result).toContain("[Image 3]");
    expect(generate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ role: "user" }),
      ]),
      "studio-video-director",
    );
  });

  it("uses a safe deterministic English fallback when the text AI is unavailable", async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(new Error("provider unavailable"));

    const result = await directStudioVideoCommand(
      {
        command: "Lüks ve sinematik, ailelere hitap eden sıcak bir video yap.",
        referenceCount: 2,
      },
      generate,
    );

    expect(result).toMatch(/luxury/i);
    expect(result).toMatch(/family/i);
    expect(result).toContain("[Image 1]");
    expect(result).toContain("[Image 2]");
    expect(result).toContain(
      "Lüks ve sinematik, ailelere hitap eden sıcak bir video yap.",
    );
  });

  it("instructs the director to preserve exact captions and social handles", async () => {
    const generate = vi.fn().mockResolvedValue({
      content: 'End on [Image 2] and render the exact caption "@jasminegroup".',
    });

    await directStudioVideoCommand(
      {
        command:
          'Son sahnede animasyonla birlikte "@jasminegroup" aynen yazsın.',
        referenceCount: 2,
      },
      generate,
    );

    const messages = generate.mock.calls[0]?.[0];
    expect(messages[0]?.content).toContain(
      "Preserve every quoted on-screen caption, @handle, phone number, price string and proper name",
    );
  });

  it("strips markdown wrappers and limits an unsafe oversized response", async () => {
    const generate = vi.fn().mockResolvedValue({
      content: `\`\`\`text\n${"cinematic motion ".repeat(200)}\n\`\`\``,
    });

    const result = await directStudioVideoCommand(
      { command: "Özel bir video yap.", referenceCount: 1 },
      generate,
    );

    expect(result).not.toContain("```");
    expect(result.length).toBeLessThanOrEqual(1_200);
  });
});
