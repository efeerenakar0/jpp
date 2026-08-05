export type StudioVideoJobStatusValue =
  | "QUEUED"
  | "SUBMITTING"
  | "GENERATING"
  | "PERSISTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

type PromptProperty = {
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
};

function clean(value: string | null | undefined, maxLength: number) {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength) || null;
}

export function buildStudioVideoPrompt(input: {
  command: string;
  property: PromptProperty;
}) {
  const property = input.property;
  const facts = [
    `Property title: ${clean(property.title, 120) || "Private property"}`,
    property.location ? `Location: ${clean(property.location, 140)}` : null,
    property.roomCount ? `Room count: ${clean(property.roomCount, 40)}` : null,
    property.area
      ? `Area: ${new Intl.NumberFormat("tr-TR").format(property.area)} m²`
      : null,
    property.price
      ? `Price: ${new Intl.NumberFormat("tr-TR").format(property.price)} TRY`
      : null,
    property.description
      ? `Verified description: ${clean(property.description, 500)}`
      : null,
  ].filter(Boolean);

  return [
    "Create a premium real-estate promotional motion video.",
    "Preserve the property, architecture, furniture and spatial layout. Use only verified elements visible in the reference images.",
    "Do not invent a room, pool, view, person, object, facade or property feature.",
    "",
    "VERIFIED PROPERTY FACTS",
    ...facts,
    "",
    "CREATIVE DIRECTION",
    clean(input.command, 1_200) ||
      "Create a natural, professional and cinematic visual sequence.",
  ].join("\n");
}

export function studioVideoProgress(status: StudioVideoJobStatusValue) {
  switch (status) {
    case "QUEUED":
      return 5;
    case "SUBMITTING":
      return 15;
    case "GENERATING":
      return 55;
    case "PERSISTING":
      return 90;
    default:
      return 100;
  }
}

export function studioVideoRetryDelayMs(attemptCount: number) {
  const exponent = Math.max(0, Math.min(4, attemptCount - 1));
  return Math.min(300_000, 30_000 * 2 ** exponent);
}
