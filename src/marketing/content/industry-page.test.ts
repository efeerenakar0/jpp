import { describe, expect, it } from "vitest";

import {
  DEVELOPING_INDUSTRY_SLUGS,
  getIndustryPageContent,
  getIndustryRoutePath,
} from "./industry-page";

describe("developing industry page contract", () => {
  it("exposes only the four approved developing-sector slugs", () => {
    expect(DEVELOPING_INDUSTRY_SLUGS).toEqual([
      "hospitality",
      "restaurants",
      "wholesale",
      "construction",
    ]);
    expect(DEVELOPING_INDUSTRY_SLUGS).not.toContain("real-estate");
  });

  it.each(["en", "tr"] as const)(
    "keeps every %s sector explicitly in active development",
    (locale) => {
      for (const slug of DEVELOPING_INDUSTRY_SLUGS) {
        const content = getIndustryPageContent(locale, slug);

        expect(content?.sector.status).toBe("in-active-development");
        expect(content?.sector.futureOperatingModel.plannedOutcomes).toHaveLength(4);
        expect(content?.industries.developmentDisclaimer.length).toBeGreaterThan(40);
        expect(content?.presentation.unavailableLabel.length).toBeGreaterThan(20);
      }
    },
  );

  it("keeps localized canonical routes reciprocal", () => {
    for (const slug of DEVELOPING_INDUSTRY_SLUGS) {
      expect(getIndustryRoutePath("en", slug)).toBe(`/industries/${slug}`);
      expect(getIndustryRoutePath("tr", slug)).toBe(`/tr/industries/${slug}`);
    }
  });

  it("preserves sector and intent presets on both contact actions", () => {
    for (const locale of ["en", "tr"] as const) {
      for (const slug of DEVELOPING_INDUSTRY_SLUGS) {
        const content = getIndustryPageContent(locale, slug);
        const hrefs = content?.sector.actions.map((action) => action.href) ?? [];

        expect(hrefs).toHaveLength(2);
        expect(hrefs.every((href) => href.includes(`sector=${slug}`))).toBe(true);
        expect(hrefs.some((href) => href.includes("intent=founding-partner"))).toBe(true);
        expect(hrefs.some((href) => href.includes("intent=demo"))).toBe(true);
      }
    }
  });

  it("fails closed for flagship and unknown slugs", () => {
    expect(getIndustryPageContent("en", "real-estate")).toBeUndefined();
    expect(getIndustryPageContent("tr", "unknown-sector")).toBeUndefined();
  });
});
