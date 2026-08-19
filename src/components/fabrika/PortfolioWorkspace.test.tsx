import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PortfolioWorkspace, {
  filterPortfolioProperties,
  getPropertyCompleteness,
  type PortfolioProperty,
} from "./PortfolioWorkspace";

const property: PortfolioProperty = {
  id: "property-1",
  title: "Avcılar OSB Fabrika Binası",
  referenceCode: "FAB-AVC-001",
  location: "Avcılar, İstanbul",
  price: 125_000_000,
  roomCount: "12 bölüm",
  area: 8_750,
  status: "ACTIVE",
  description: "Yüksek tavanlı modern üretim tesisi.",
  imageUrl: "https://example.com/factory.jpg",
  sellerPortalToken: "seller-token",
  sellerPortalEnabled: true,
  listingViews: 40,
  inquiryCount: 8,
  showingCount: 3,
  offerCount: 1,
  ownerContact: { id: "owner-1", name: "Jasmine Kaya" },
  assignedMember: { id: "member-1", name: "Deniz Yılmaz" },
};

describe("PortfolioWorkspace", () => {
  it("renders the redesigned portfolio content with real actions and no shell chrome", () => {
    const html = renderToStaticMarkup(
      <PortfolioWorkspace
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onMedia={vi.fn()}
        onPublicationChange={vi.fn(async () => true)}
        onReload={vi.fn(async () => undefined)}
        onSelect={vi.fn()}
        onViewChange={vi.fn()}
        portfolioView="properties"
        properties={[property]}
        selectedProperty={property}
      />,
    );

    expect(html).toContain("Portföy Yönetimi");
    expect(html).toContain("Portföy sağlığı");
    expect(html).toContain("Avcılar OSB Fabrika Binası");
    expect(html).toContain("Fotoğraflar");
    expect(html).toContain("Pazarlamada kullan");
    expect(html).toContain('aria-label="Portföy filtreleri"');
    expect(html).not.toContain("Ana Panel");
    expect(html).not.toContain("Şirket Ayarlarınız");
  });

  it("filters by Turkish search text and publication status", () => {
    const draftProperty = {
      ...property,
      id: "property-2",
      title: "Çerkezköy Depo Alanı",
      referenceCode: "DEP-CRK-002",
      status: "DRAFT" as const,
    };

    expect(
      filterPortfolioProperties([property, draftProperty], "çerkez", "DRAFT"),
    ).toEqual([draftProperty]);
    expect(
      filterPortfolioProperties([property, draftProperty], "çerkez", "ACTIVE"),
    ).toEqual([]);
  });

  it("groups sold and rented portfolios in the completed metric", () => {
    const soldProperty = {
      ...property,
      id: "property-2",
      status: "SOLD" as const,
    };
    const rentedProperty = {
      ...property,
      id: "property-3",
      status: "RENTED" as const,
    };

    expect(
      filterPortfolioProperties(
        [property, soldProperty, rentedProperty],
        "",
        "CLOSED",
      ),
    ).toEqual([soldProperty, rentedProperty]);
  });

  it("calculates the completion score from visible portfolio fields", () => {
    expect(getPropertyCompleteness(property)).toBe(100);
    expect(
      getPropertyCompleteness({
        ...property,
        description: null,
        imageUrl: null,
      }),
    ).toBe(71);
  });
});
