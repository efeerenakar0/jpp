"use client";

import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Edit3,
  ExternalLink,
  Gauge,
  Home,
  MapPin,
  Megaphone,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Target,
  UploadCloud,
  X,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import PortfolioSourcesPanel from "@/components/fabrika/PortfolioSourcesPanel";
import styles from "./PortfolioWorkspace.module.css";

export type PortfolioProperty = {
  id: string;
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  status: "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "RENTED" | "ARCHIVED";
  description: string | null;
  imageUrl: string | null;
  sellerPortalToken: string;
  sellerPortalEnabled: boolean;
  listingViews: number;
  inquiryCount: number;
  showingCount: number;
  offerCount: number;
  ownerContact: { id: string; name: string } | null;
  assignedMember: { id: string; name: string } | null;
};

type PortfolioView = "properties" | "owner-reports" | "sources";
type PortfolioStatusFilter = "ALL" | "CLOSED" | PortfolioProperty["status"];

const STATUS_LABELS: Record<PortfolioProperty["status"], string> = {
  DRAFT: "Taslak",
  ACTIVE: "Yayında",
  RESERVED: "Rezerve",
  SOLD: "Satıldı",
  RENTED: "Kiralandı",
  ARCHIVED: "Arşiv",
};

const FILTER_OPTIONS: Array<{
  label: string;
  value: PortfolioStatusFilter;
}> = [
  { label: "Tümü", value: "ALL" },
  { label: "Yayında", value: "ACTIVE" },
  { label: "Taslak", value: "DRAFT" },
  { label: "Satıldı", value: "SOLD" },
  { label: "Kiralandı", value: "RENTED" },
];

function money(value: number | null | undefined) {
  if (!value) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getPropertyCompleteness(property: PortfolioProperty) {
  const fields = [
    property.title,
    property.location,
    property.price,
    property.roomCount,
    property.area,
    property.description,
    property.imageUrl,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export function filterPortfolioProperties(
  properties: PortfolioProperty[],
  query: string,
  status: PortfolioStatusFilter,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  return properties.filter((property) => {
    const matchesStatus =
      status === "ALL" ||
      (status === "CLOSED"
        ? property.status === "SOLD" || property.status === "RENTED"
        : property.status === status);
    const matchesQuery =
      !normalizedQuery ||
      [
        property.title,
        property.referenceCode,
        property.location,
        property.description,
      ]
        .filter(Boolean)
        .some((value) =>
          value!.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
        );
    return matchesStatus && matchesQuery;
  });
}

export default function PortfolioWorkspace({
  properties,
  portfolioView,
  selectedProperty,
  onViewChange,
  onSelect,
  onAdd,
  onEdit,
  onMedia,
  onReload,
  onPublicationChange,
}: {
  properties: PortfolioProperty[];
  portfolioView: PortfolioView;
  selectedProperty: PortfolioProperty | null;
  onViewChange: (view: PortfolioView) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onMedia: (property: PortfolioProperty) => void;
  onReload: () => Promise<void>;
  onPublicationChange: (
    property: PortfolioProperty,
    status: "DRAFT" | "ACTIVE",
  ) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PortfolioStatusFilter>("ALL");

  const filteredProperties = useMemo(
    () => filterPortfolioProperties(properties, query, statusFilter),
    [properties, query, statusFilter],
  );
  const healthScore = properties.length
    ? Math.round(
        properties.reduce(
          (total, property) => total + getPropertyCompleteness(property),
          0,
        ) / properties.length,
      )
    : 0;

  const metrics = [
    {
      label: "Toplam portföy",
      value: properties.length,
      detail: "Tüm kayıtlar",
      icon: Building2,
      tone: "navy",
      filter: "ALL" as const,
    },
    {
      label: "Yayında",
      value: properties.filter((property) => property.status === "ACTIVE")
        .length,
      detail: "Aktif ilanlar",
      icon: Home,
      tone: "green",
      filter: "ACTIVE" as const,
    },
    {
      label: "Taslak",
      value: properties.filter((property) => property.status === "DRAFT")
        .length,
      detail: "Tamamlanmayı bekliyor",
      icon: Building2,
      tone: "amber",
      filter: "DRAFT" as const,
    },
    {
      label: "Kiralandı / Satıldı",
      value: properties.filter(
        (property) =>
          property.status === "SOLD" || property.status === "RENTED",
      ).length,
      detail: "Sonuçlanan portföyler",
      icon: Target,
      tone: "blue",
      filter: "CLOSED" as const,
    },
  ];

  const activeProperty =
    selectedProperty || filteredProperties[0] || properties[0] || null;
  const activeCompleteness = activeProperty
    ? getPropertyCompleteness(activeProperty)
    : 0;

  return (
    <div className={styles.workspace} data-page="portfolio">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Portföy merkezi</span>
          <h1>Portföy Yönetimi</h1>
          <p>Tüm portföylerinizi tek merkezden yönetin.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.secondaryButton}
            onClick={() => onViewChange("sources")}
            type="button"
          >
            <UploadCloud aria-hidden="true" />
            Web sitesinden içe aktar
          </button>
          <button
            className={styles.primaryButton}
            onClick={onAdd}
            type="button"
          >
            <Plus aria-hidden="true" />
            Yeni portföy
          </button>
        </div>
      </header>

      <nav className={styles.modeTabs} aria-label="Portföy bölümleri">
        <button
          aria-pressed={portfolioView === "properties"}
          onClick={() => onViewChange("properties")}
          type="button"
        >
          Portföyler
        </button>
        <button
          aria-pressed={portfolioView === "owner-reports"}
          onClick={() => onViewChange("owner-reports")}
          type="button"
        >
          Malik raporları
        </button>
        <button
          aria-pressed={portfolioView === "sources"}
          onClick={() => onViewChange("sources")}
          type="button"
        >
          Kaynaklar ve onay
        </button>
      </nav>

      {portfolioView === "sources" ? (
        <section className={styles.subviewSurface}>
          <PortfolioSourcesPanel onPortfolioChanged={onReload} />
        </section>
      ) : portfolioView === "owner-reports" ? (
        <section className={styles.reportGrid} aria-label="Malik raporları">
          {properties.map((property) => (
            <article key={property.id}>
              <span className={styles.reportIcon}>
                <Share2 aria-hidden="true" />
              </span>
              <div>
                <h2>{property.title}</h2>
                <p>
                  {property.ownerContact?.name || "Mülk sahibi atanmadı"} ·{" "}
                  {property.location || "Konum yok"}
                </p>
                <span>
                  {property.listingViews +
                    property.inquiryCount +
                    property.showingCount +
                    property.offerCount}{" "}
                  toplam etkileşim
                </span>
              </div>
              <Link
                href={`/portfoy-takip/${property.sellerPortalToken}`}
                target="_blank"
              >
                Raporu aç <ExternalLink aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <>
          <section className={styles.healthPanel} aria-label="Portföy özeti">
            <div className={styles.healthIntro}>
              <div
                className={styles.healthRing}
                style={
                  {
                    "--health-score": `${healthScore * 3.6}deg`,
                  } as CSSProperties
                }
                aria-label={`Portföy sağlığı yüzde ${healthScore}`}
              >
                <strong>{healthScore}</strong>
                <span>/100</span>
              </div>
              <div>
                <span className={styles.healthLabel}>Portföy sağlığı</span>
                <strong>
                  {healthScore >= 75
                    ? "İyi durumdasınız"
                    : "Birlikte güçlendirelim"}
                </strong>
                <p>Eksik bilgileri tamamlayarak görünürlüğünüzü artırın.</p>
                <button
                  onClick={() => activeProperty && onEdit(activeProperty.id)}
                  type="button"
                >
                  Eksik bilgileri tamamla <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className={styles.metricGrid}>
              {metrics.map((metric) => (
                <button
                  aria-pressed={statusFilter === metric.filter}
                  data-tone={metric.tone}
                  key={metric.label}
                  onClick={() => setStatusFilter(metric.filter)}
                  type="button"
                >
                  <metric.icon aria-hidden="true" />
                  <span className={styles.metricCopy}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.filterBar} aria-label="Portföy filtreleri">
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Portföy ara</span>
              <Search aria-hidden="true" />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Portföy ara"
                type="search"
                value={query}
              />
            </label>
            <div className={styles.filterPills}>
              {FILTER_OPTIONS.map((option) => (
                <button
                  aria-pressed={statusFilter === option.value}
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  type="button"
                >
                  <span aria-hidden="true" data-status={option.value} />
                  {option.label}
                </button>
              ))}
            </div>
            <button className={styles.moreFilters} type="button">
              <SlidersHorizontal aria-hidden="true" />
              Diğer filtreler
            </button>
            {(query || statusFilter !== "ALL") && (
              <button
                className={styles.clearFilters}
                onClick={() => {
                  setQuery("");
                  setStatusFilter("ALL");
                }}
                type="button"
              >
                <X aria-hidden="true" /> Temizle
              </button>
            )}
          </section>

          <div className={styles.contentGrid}>
            <section className={styles.listPanel} aria-label="Portföy listesi">
              <div className={styles.listHeader} aria-hidden="true">
                <span>Portföy</span>
                <span>Durum</span>
                <span>Tip</span>
                <span>Lokasyon</span>
                <span>Fiyat</span>
                <span>Sağlık</span>
                <span />
              </div>
              <div className={styles.propertyList}>
                {filteredProperties.length ? (
                  filteredProperties.map((property) => (
                    <button
                      aria-pressed={activeProperty?.id === property.id}
                      className={styles.propertyRow}
                      key={property.id}
                      onClick={() => onSelect(property.id)}
                      type="button"
                    >
                      <span className={styles.propertyIdentity}>
                        <span className={styles.thumbnail}>
                          {property.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- tenant media can use arbitrary external storage URLs.
                            <img alt="" src={property.imageUrl} />
                          ) : (
                            <Home aria-hidden="true" />
                          )}
                        </span>
                        <span>
                          <strong>{property.title}</strong>
                          <small>
                            REF:{" "}
                            {property.referenceCode ||
                              property.id.slice(0, 10).toUpperCase()}
                          </small>
                        </span>
                      </span>
                      <span
                        className={styles.statusPill}
                        data-status={property.status}
                      >
                        {STATUS_LABELS[property.status]}
                      </span>
                      <span className={styles.propertyType}>Gayrimenkul</span>
                      <span className={styles.locationCell}>
                        <MapPin aria-hidden="true" />
                        {property.location || "Konum belirtilmedi"}
                      </span>
                      <span className={styles.priceCell}>
                        <strong>{money(property.price)}</strong>
                        <small>
                          {property.area
                            ? `${property.area} m²`
                            : "Alan belirtilmedi"}
                        </small>
                      </span>
                      <span
                        aria-label={`Portföy sağlığı yüzde ${getPropertyCompleteness(property)}`}
                        className={styles.rowHealth}
                        style={
                          {
                            "--row-health": `${getPropertyCompleteness(property) * 3.6}deg`,
                          } as CSSProperties
                        }
                      >
                        {getPropertyCompleteness(property)}
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyList}>
                    <Search aria-hidden="true" />
                    <h2>Bu filtrelerle portföy bulunamadı</h2>
                    <p>
                      Arama kelimesini veya durum filtresini
                      değiştirebilirsiniz.
                    </p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatusFilter("ALL");
                      }}
                      type="button"
                    >
                      Filtreleri temizle
                    </button>
                  </div>
                )}
              </div>
              <footer className={styles.listFooter}>
                <span>
                  <strong>{filteredProperties.length}</strong> portföy
                  gösteriliyor
                </span>
                <span>Toplam {properties.length} kayıt</span>
              </footer>
            </section>

            <aside
              className={styles.detailPanel}
              aria-label="Seçili portföy detayı"
            >
              {activeProperty ? (
                <>
                  <div className={styles.detailImage}>
                    {activeProperty.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tenant media can use arbitrary external storage URLs.
                      <img
                        alt={activeProperty.title}
                        src={activeProperty.imageUrl}
                      />
                    ) : (
                      <Home aria-hidden="true" />
                    )}
                    <span className={styles.imageCount}>
                      <Camera aria-hidden="true" /> Portföy görseli
                    </span>
                  </div>

                  <div className={styles.detailHeading}>
                    <div>
                      <span
                        className={styles.statusPill}
                        data-status={activeProperty.status}
                      >
                        {STATUS_LABELS[activeProperty.status]}
                      </span>
                      <h2>{activeProperty.title}</h2>
                      <button
                        aria-label="Referans kodunu kopyala"
                        onClick={() =>
                          void navigator.clipboard?.writeText(
                            activeProperty.referenceCode || activeProperty.id,
                          )
                        }
                        type="button"
                      >
                        REF:{" "}
                        {activeProperty.referenceCode ||
                          activeProperty.id.slice(0, 10).toUpperCase()}
                        <Copy aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      aria-label="Portföyü düzenle"
                      className={styles.iconButton}
                      onClick={() => onEdit(activeProperty.id)}
                      type="button"
                    >
                      <Edit3 aria-hidden="true" />
                    </button>
                  </div>

                  <section className={styles.completeness}>
                    <div>
                      <div>
                        <span>Tamamlanma skoru</span>
                        <strong>{activeCompleteness}%</strong>
                      </div>
                      <progress max="100" value={activeCompleteness} />
                    </div>
                    <p>
                      Daha güçlü bir portföy için eksik bilgileri tamamlayın.
                    </p>
                    <button
                      onClick={() => onEdit(activeProperty.id)}
                      type="button"
                    >
                      Eksik bilgileri tamamla <ArrowRight aria-hidden="true" />
                    </button>
                  </section>

                  <dl className={styles.propertyFacts}>
                    <div>
                      <dt>
                        <Building2 aria-hidden="true" /> Tip
                      </dt>
                      <dd>Gayrimenkul</dd>
                    </div>
                    <div>
                      <dt>
                        <BedDouble aria-hidden="true" /> Oda
                      </dt>
                      <dd>{activeProperty.roomCount || "—"}</dd>
                    </div>
                    <div>
                      <dt>
                        <MapPin aria-hidden="true" /> Lokasyon
                      </dt>
                      <dd>{activeProperty.location || "Belirtilmedi"}</dd>
                    </div>
                    <div>
                      <dt>
                        <Gauge aria-hidden="true" /> Alan
                      </dt>
                      <dd>
                        {activeProperty.area
                          ? `${activeProperty.area} m²`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <CircleDollarSign aria-hidden="true" /> Fiyat
                      </dt>
                      <dd>{money(activeProperty.price)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Target aria-hidden="true" /> Leads
                      </dt>
                      <dd>{activeProperty.inquiryCount}</dd>
                    </div>
                  </dl>

                  <div className={styles.detailActions}>
                    <button
                      className={styles.publishButton}
                      onClick={() =>
                        void onPublicationChange(
                          activeProperty,
                          activeProperty.status === "ACTIVE"
                            ? "DRAFT"
                            : "ACTIVE",
                        )
                      }
                      type="button"
                    >
                      {activeProperty.status === "ACTIVE" ? (
                        <X aria-hidden="true" />
                      ) : (
                        <CheckCircle2 aria-hidden="true" />
                      )}
                      {activeProperty.status === "ACTIVE"
                        ? "Yayından kaldır"
                        : "Yayına al"}
                    </button>
                    <div>
                      <button
                        onClick={() => onMedia(activeProperty)}
                        type="button"
                      >
                        <Camera aria-hidden="true" /> Fotoğraflar
                      </button>
                      <button
                        onClick={() => onEdit(activeProperty.id)}
                        type="button"
                      >
                        <Edit3 aria-hidden="true" /> Düzenle
                      </button>
                    </div>
                    <Link
                      href={`/fabrika/pazarlamaci?propertyId=${encodeURIComponent(activeProperty.id)}`}
                    >
                      <Megaphone aria-hidden="true" /> Pazarlamada kullan
                    </Link>
                  </div>
                </>
              ) : (
                <div className={styles.emptyDetail}>
                  <Home aria-hidden="true" />
                  <h2>Henüz portföy yok</h2>
                  <p>
                    İlk portföyünüzü ekleyerek bu alanı kullanmaya başlayın.
                  </p>
                  <button onClick={onAdd} type="button">
                    <Plus aria-hidden="true" /> Yeni portföy
                  </button>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
