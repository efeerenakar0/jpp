import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DomesticMarketingFlow from "./DomesticMarketingFlow";

describe("DomesticMarketingFlow", () => {
  it("starts with the four-step studio and preserves every campaign source", () => {
    const html = renderToStaticMarkup(
      <DomesticMarketingFlow
        companyName="Jasmine Group"
        properties={[
          {
            id: "property-1",
            title: "Deniz manzaralı daire",
            location: "Alanya",
            price: 8_500_000,
            imageUrl: null,
            referenceCode: "JG-101",
            status: "ACTIVE",
          },
        ]}
        campaigns={[]}
        creativeAssets={[]}
        onRefresh={async () => undefined}
      />,
    );

    expect(html).toContain("Kaynak");
    expect(html).toContain("Hedef");
    expect(html).toContain("İçerikler");
    expect(html).toContain("Kontrol");
    expect(html).toContain("Portföy kampanyası");
    expect(html).toContain("Şirket tanıtımı");
    expect(html).toContain("Web sitesi planı");
    expect(html).toContain("Son çalışmalar");
    expect(html).toContain("Deniz manzaralı daire");
    expect(html).not.toContain("&quot;caption&quot;");
  });
});
