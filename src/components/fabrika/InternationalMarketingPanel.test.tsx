import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InternationalMarketingPanel, {
  orderedPortalChoices,
  providerLabel,
} from "./InternationalMarketingPanel";
import { INTERNATIONAL_MARKETS } from "@/lib/international-marketing";

describe("InternationalMarketingPanel", () => {
  it("starts with a simple three-step international flow", () => {
    const html = renderToStaticMarkup(
      <InternationalMarketingPanel
        properties={[
          {
            id: "property-1",
            title: "Alanya sahil dairesi",
            location: "Alanya",
            price: 8_500_000,
            referenceCode: "JG-101",
          },
        ]}
        campaigns={[]}
        loading={false}
        onGenerated={async () => undefined}
      />,
    );

    expect(html).toContain("Portföy");
    expect(html).toContain("Ülke ve portal");
    expect(html).toContain("Hazır plan");
    expect(html).toContain("Alanya sahil dairesi");
  });

  it("does not label deterministic fallback copy as AI-generated", () => {
    expect(providerLabel("RULE_ENGINE")).toBe(
      "Doğrulanmış kurallarla hazırlandı",
    );
    expect(providerLabel("FALLBACK")).toBe("Doğrulanmış kurallarla hazırlandı");
    expect(providerLabel("openai")).toBe("AI destekli");
  });

  it("shows every catalog portal after a country is selected and keeps the recommendation first", () => {
    const germany = INTERNATIONAL_MARKETS.find(
      (market) => market.code === "DE",
    );
    expect(germany).toBeDefined();

    const choices = orderedPortalChoices(germany!);
    expect(choices).toHaveLength(germany!.portals.length);
    expect(new Set(choices.map((portal) => portal.id)).size).toBe(
      germany!.portals.length,
    );
    expect(choices[0]?.id).toBe("immobilienscout24-de");
  });
});
