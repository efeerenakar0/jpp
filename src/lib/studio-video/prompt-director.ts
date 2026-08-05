import "server-only";

import { callAI, type ChatMessage } from "@/lib/ai";

type TextGenerator = (
  messages: ChatMessage[],
  requestType: string,
) => Promise<{ content: string }>;

function cleanDirection(value: string) {
  return value
    .replace(/```(?:text|markdown)?/gi, "")
    .replace(/```/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200);
}

function fallbackDirection(command: string, referenceCount: number) {
  const normalized = command.toLocaleLowerCase("tr-TR");
  const directions = [
    normalized.includes("lüks") || normalized.includes("sinematik")
      ? "Use refined luxury real-estate cinematography, elegant slow camera motion, natural contrast and premium pacing."
      : null,
    normalized.includes("aile")
      ? "Create a warm, welcoming and family-oriented atmosphere with gentle pacing and inviting daylight."
      : null,
    normalized.includes("enerjik") || normalized.includes("dikkat")
      ? "Use an attention-grabbing opening, energetic camera motion and decisive visual transitions."
      : null,
    normalized.includes("yatırım")
      ? "Emphasize the property as a credible investment opportunity without inventing financial claims."
      : null,
    normalized.includes("sade") || normalized.includes("minimal")
      ? "Keep the composition minimal, calm and free of decorative visual clutter."
      : null,
    normalized.includes("akşam") || normalized.includes("gece")
      ? "Use a tasteful evening mood while preserving the real architecture and visible lighting sources."
      : null,
    normalized.includes("ilk") && normalized.includes("sonra")
      ? "Follow the requested shot order precisely: establish the first reference, then perform each requested reveal and transition in sequence."
      : null,
    normalized.includes("fiyat")
      ? "Show or hide the verified price exactly as requested; never invent a different amount."
      : null,
    normalized.includes("instagram")
      ? "Use the exact Instagram handle supplied by the user in the requested final scene; do not invent a handle."
      : null,
  ].filter(Boolean);
  const references = Array.from(
    { length: Math.max(1, Math.min(referenceCount, 9)) },
    (_, index) => `[Image ${index + 1}]`,
  ).join(", ");
  return cleanDirection(
    [
      directions.length
        ? directions.join(" ")
        : "Create a natural, professional real-estate motion video with clear visual storytelling.",
      `Use the supplied references in this order: ${references}.`,
      "Preserve every visible architectural and property detail. Do not invent rooms, objects, views or amenities.",
      `Original user request in Turkish (preserve its sequencing, quoted captions, @handles, numbers and proper names exactly): ${cleanDirection(command).slice(0, 700)}`,
    ].join(" "),
  );
}

export async function directStudioVideoCommand(
  input: { command: string; referenceCount: number },
  generate: TextGenerator = callAI,
) {
  const fallback = fallbackDirection(input.command, input.referenceCount);
  try {
    const response = await generate(
      [
        {
          role: "system",
          content: [
            "You are a professional real-estate video director for the Seedance 2.0 API.",
            "Convert the Turkish user request into one concise English production direction.",
            "Follow the request faithfully; do not add property facts, promises or amenities.",
            "Refer to supplied images only as [Image 1], [Image 2] and so on in their request order.",
            "Describe camera motion, timing, pacing, transitions, atmosphere and sequencing.",
            "Preserve every quoted on-screen caption, @handle, phone number, price string and proper name from the user request verbatim; translate only the surrounding direction.",
            "Return plain English text only, no JSON, markdown, code or commentary. Maximum 900 characters.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Reference image count: ${Math.max(1, Math.min(input.referenceCount, 9))}\nTurkish creative request: ${input.command.slice(0, 1_000)}`,
        },
      ],
      "studio-video-director",
    );
    const directed = cleanDirection(response.content);
    return directed.length >= 20 ? directed : fallback;
  } catch {
    return fallback;
  }
}
