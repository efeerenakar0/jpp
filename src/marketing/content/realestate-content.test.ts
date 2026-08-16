import { describe, expect, it } from "vitest";

import { pricingContent } from "./en/pricing";
import { realEstateContent } from "./en/realestate";

describe("Real Estate public content safeguards", () => {
  it("keeps the selected hero headline resolvable", () => {
    expect(
      realEstateContent.hero.headlineAlternatives.some(
        (headline) => headline.id === realEstateContent.hero.selectedHeadlineId,
      ),
    ).toBe(true);
  });

  it("uses only the two approved proof metrics", () => {
    expect(realEstateContent.proof.metrics.map((metric) => metric.id)).toEqual([
      "response-speed",
      "portfolio-opportunities",
    ]);
  });

  it("keeps proposed six- and twelve-month prices private", () => {
    expect(
      pricingContent.pendingOptions.every(
        (option) => option.pendingApproval && !option.isPublic,
      ),
    ).toBe(true);
    expect(pricingContent.plans[0].price.isPublic).toBe(true);
    expect(pricingContent.plans[0].price.formatted).toBe("₺11.350");
    expect(pricingContent.plans[1].priceLabel).toBe("Contact Sales");
  });

  it("keeps the approved AI disclosure visible in the content contract", () => {
    expect(realEstateContent.whatsappOperations.aiDisclosure).toBe(
      "You’re speaking with Business CEO AI’s virtual assistant. A team member can take over at any time.",
    );
  });

  it("does not claim marketplace affiliation or an unverified certification", () => {
    expect(realEstateContent.portfolioHunter.scopeNote).toContain("does not claim affiliation");
    expect(realEstateContent.security.certificationNote).toContain("No unverified certification");
  });
});
