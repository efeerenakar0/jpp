import { describe, expect, it } from "vitest";

import {
  getLegalPageContent,
  isLegalSlug,
  LEGAL_SLUGS,
} from "./legal";

describe("legal placeholder content", () => {
  it("ships every required document in both locales", () => {
    expect(LEGAL_SLUGS).toHaveLength(8);

    for (const slug of LEGAL_SLUGS) {
      const english = getLegalPageContent("en", slug);
      const turkish = getLegalPageContent("tr", slug);

      expect(english.status).toBe("Draft — requires legal review");
      expect(turkish.status).toBe("Taslak — hukuki inceleme gerektirir");
      expect(english.title.length).toBeGreaterThan(2);
      expect(turkish.title.length).toBeGreaterThan(2);
    }
  });

  it("rejects arbitrary legal slugs", () => {
    expect(isLegalSlug("privacy")).toBe(true);
    expect(isLegalSlug("approved-policy")).toBe(false);
  });
});
