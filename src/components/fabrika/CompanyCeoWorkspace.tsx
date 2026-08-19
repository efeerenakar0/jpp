"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import WorkspacePage from "@/components/fabrika/WorkspacePage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildCompanyCeoSnapshot,
  companyCeoManagerSchema,
  companyCeoMarketingSchema,
  companyCeoWorkspaceSchema,
} from "@/lib/company-ceo-view";
import styles from "./CompanyCeoWorkspace.module.css";

type CompanyCeoSection = "overview" | "customers" | "pipeline";
type Snapshot = ReturnType<typeof buildCompanyCeoSnapshot>;
type DetailView = "performance" | "alerts" | "report" | null;

const STAGE_LABELS: Record<string, string> = {
  NEW: "Yeni",
  CONTACTED: "Temas kuruldu",
  QUALIFIED: "Nitelikli",
  MATCHED: "Eşleşti",
  VIEWING: "Gösterim",
  OFFER: "Teklif",
  CONTRACT: "Sözleşme",
};

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Veriler yüklenemedi.",
    );
  }
  return body;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export default function CompanyCeoWorkspace({
  initialSection = "overview",
  initialSnapshot = null,
}: {
  initialSection?: CompanyCeoSection;
  initialSnapshot?: Snapshot | null;
}) {
  const [section, setSection] = useState<CompanyCeoSection>(initialSection);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot);
  const [loading, setLoading] = useState(
    initialSection === "overview" && !initialSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailView>(null);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const [workspaceResult, managerResult, marketingResult] =
        await Promise.allSettled([
          fetchJson("/api/fabrika/workspace", signal),
          fetchJson("/api/fabrika/general-manager/dashboard", signal),
          fetchJson("/api/fabrika/marketing/campaigns", signal),
        ]);

      if (workspaceResult.status === "rejected") throw workspaceResult.reason;
      if (managerResult.status === "rejected") throw managerResult.reason;

      const workspaceEnvelope = workspaceResult.value;
      if (workspaceEnvelope.success !== true) {
        throw new Error(
          typeof workspaceEnvelope.error === "string"
            ? workspaceEnvelope.error
            : "Şirket çalışma alanı yüklenemedi.",
        );
      }

      const workspace = companyCeoWorkspaceSchema.parse(
        workspaceEnvelope.workspace,
      );
      const manager = companyCeoManagerSchema.parse(managerResult.value);
      const campaigns =
        marketingResult.status === "fulfilled"
          ? companyCeoMarketingSchema.parse(marketingResult.value).campaigns
          : [];

      if (marketingResult.status === "rejected") {
        setWarning(
          "Kampanya verileri şu anda alınamadı; diğer şirket verileri günceldir.",
        );
      }

      setSnapshot(buildCompanyCeoSnapshot(workspace, manager, campaigns));
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Şirket özeti yüklenemedi.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section !== "overview" || snapshot) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadOverview(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadOverview, section, snapshot]);

  if (section !== "overview") {
    return (
      <div className={styles.subWorkspace}>
        <button
          className={styles.backButton}
          onClick={() => setSection("overview")}
          type="button"
        >
          <ArrowLeft aria-hidden="true" />
          Şirket özetine dön
        </button>
        <WorkspacePage
          initialView={section === "pipeline" ? "pipeline" : "customers"}
          mode="crm"
        />
      </div>
    );
  }

  return (
    <div className={styles.commandDeck}>
      <header className={styles.masthead}>
        <div className={styles.mastheadCopy}>
          <div className={styles.liveLine}>
            <span className={styles.liveStatus}>
              <span aria-hidden="true" className={styles.liveDot} />
              Canlı şirket görünümü
            </span>
            {snapshot && (
              <span>
                Son kontrol{" "}
                <time dateTime={snapshot.generatedAt}>
                  {formatTime(snapshot.generatedAt)}
                </time>
              </span>
            )}
          </div>
          <p className={styles.eyebrow}>AI ŞİRKET CEO</p>
          <h1 className={styles.mastheadTitle}>
            Bugün neye odaklanmanız gerektiğini görün.
          </h1>
          <p className={styles.mastheadDescription}>
            {snapshot?.companyName
              ? `${snapshot.companyName} için satış, ekip ve risk sinyalleri tek bir karar ekranında.`
              : "Satış, ekip ve risk sinyallerini tek bir karar ekranında takip edin."}
          </p>
        </div>
        <div className={styles.mastheadActions}>
          <button
            className={styles.secondaryButton}
            disabled={loading}
            onClick={() => void loadOverview()}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? styles.spinning : undefined}
            />
            Yenile
          </button>
          <button
            className={styles.primaryButton}
            disabled={!snapshot}
            onClick={() => setDetailView("alerts")}
            type="button"
          >
            Kararları incele
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      {warning && (
        <div className={styles.warningBanner} role="status">
          <AlertTriangle aria-hidden="true" />
          {warning}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => void loadOverview()} />
      ) : loading || !snapshot ? (
        <CompanyCeoSkeleton />
      ) : (
        <div aria-live="polite" className={styles.loadedContent}>
          <section
            aria-labelledby="ceo-briefing-title"
            className={styles.briefingCanvas}
          >
            <div className={styles.briefingBeam} aria-hidden="true" />
            <div className={styles.briefingCopy}>
              <div className={styles.briefingLabel}>
                <Sparkles aria-hidden="true" />
                AI yönetici brifingi
              </div>
              <h2 id="ceo-briefing-title">Şirketin bugünkü nabzı</h2>
              <p className={styles.briefingText}>{snapshot.report}</p>
              <button
                className={styles.briefingButton}
                onClick={() => setDetailView("report")}
                type="button"
              >
                Brifingin tamamını aç
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <div
              className={styles.signalStack}
              aria-label="Öncelikli sinyaller"
            >
              <Signal
                icon={AlertTriangle}
                label="Karar bekleyen"
                tone={snapshot.criticalAlerts.length > 0 ? "warning" : "good"}
                value={snapshot.criticalAlerts.length}
              />
              <Signal
                icon={CircleDollarSign}
                label="Açık satış hattı"
                tone="neutral"
                value={formatCompactCurrency(snapshot.metrics.pipelineValue)}
              />
              <Signal
                icon={Target}
                label="Ortalama eşleşme"
                tone="good"
                value={`%${Math.round(snapshot.metrics.averageMatchScore)}`}
              />
            </div>
          </section>

          <section
            aria-label="Şirketin temel göstergeleri"
            className={styles.metricGrid}
          >
            <MetricTile
              detail={`${snapshot.metrics.opportunities} açık fırsat`}
              icon={TrendingUp}
              label="Satış hattı"
              value={formatCompactCurrency(snapshot.metrics.pipelineValue)}
            />
            <MetricTile
              detail="Doğrulanmış kapanışlardan"
              icon={CircleDollarSign}
              label="Kazanılan komisyon"
              tone="mint"
              value={formatCompactCurrency(snapshot.metrics.wonCommission)}
            />
            <MetricTile
              detail={`${snapshot.metrics.customers} müşteri kaydı`}
              icon={Building2}
              label="Aktif portföy"
              tone="violet"
              value={snapshot.metrics.portfolios}
            />
            <MetricTile
              detail={`${snapshot.metrics.upcomingCriticalTasks} yaklaşan kritik görev`}
              icon={CalendarCheck2}
              label="Geciken görev"
              tone={snapshot.metrics.overdueTasks > 0 ? "warning" : "mint"}
              value={snapshot.metrics.overdueTasks}
            />
          </section>

          <div className={styles.primaryGrid}>
            <ThirtyDayCanvas
              onOpenPipeline={() => setSection("pipeline")}
              outlook={snapshot.thirtyDayOutlook}
            />
            <DecisionRail
              alerts={snapshot.criticalAlerts}
              onOpen={() => setDetailView("alerts")}
            />
          </div>

          <div className={styles.secondaryGrid}>
            <PipelineCanvas
              onOpen={() => setSection("pipeline")}
              stages={snapshot.pipelineStages}
            />
            <TeamCanvas
              members={snapshot.employeePerformance}
              onOpen={() => setDetailView("performance")}
            />
          </div>

          <DestinationGrid
            onOpenCustomers={() => setSection("customers")}
            onOpenPerformance={() => setDetailView("performance")}
            onOpenPipeline={() => setSection("pipeline")}
          />
        </div>
      )}

      <DetailDialog
        detailView={detailView}
        onClose={() => setDetailView(null)}
        snapshot={snapshot}
      />
    </div>
  );
}

function Signal({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: "good" | "warning" | "neutral";
  value: string | number;
}) {
  return (
    <div className={styles.signal} data-tone={tone}>
      <span className={styles.signalIcon}>
        <Icon aria-hidden="true" />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function MetricTile({
  detail,
  icon: Icon,
  label,
  tone = "blue",
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone?: "blue" | "mint" | "violet" | "warning";
  value: string | number;
}) {
  return (
    <article className={styles.metricTile} data-tone={tone}>
      <div className={styles.metricTopline}>
        <span>{label}</span>
        <span className={styles.metricIcon}>
          <Icon aria-hidden="true" />
        </span>
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function ThirtyDayCanvas({
  onOpenPipeline,
  outlook,
}: {
  onOpenPipeline: () => void;
  outlook: Snapshot["thirtyDayOutlook"];
}) {
  const confidenceLabel = {
    high: "Yüksek güven",
    medium: "Orta güven",
    low: "Düşük güven",
  }[outlook.confidence];

  return (
    <section
      aria-labelledby="thirty-day-title"
      className={styles.outlookCanvas}
    >
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>
            <Gauge aria-hidden="true" />
            Açıklanabilir hesap
          </span>
          <h2 id="thirty-day-title">30 Günlük Görünüm</h2>
        </div>
        <span
          className={styles.confidenceBadge}
          data-level={outlook.confidence}
        >
          {confidenceLabel}
        </span>
      </div>

      {outlook.status === "available" ? (
        <>
          <div className={styles.outlookLead}>
            <div>
              <span>Olasılık ağırlıklı komisyon</span>
              <strong>{formatCurrency(outlook.expectedCommission)}</strong>
            </div>
            <p>
              {outlook.eligibleDealCount} tarihli fırsat · %
              {outlook.dataCoverage} veri kapsamı
            </p>
          </div>

          <div
            aria-label="Komisyon senaryoları"
            className={styles.scenarioRail}
          >
            <Scenario label="Temkinli" value={outlook.conservativeCommission} />
            <Scenario
              featured
              label="Ağırlıklı"
              value={outlook.expectedCommission}
            />
            <Scenario label="Olumlu" value={outlook.optimisticCommission} />
          </div>

          {outlook.topOpportunities.length > 0 && (
            <div className={styles.opportunityList}>
              <div className={styles.listHeading}>
                <span>Görünümü en çok etkileyen fırsatlar</span>
                <span>Beklenen katkı</span>
              </div>
              {outlook.topOpportunities.map((opportunity) => (
                <div className={styles.opportunityRow} key={opportunity.id}>
                  <span>
                    <strong>{opportunity.title}</strong>
                    <small>
                      {STAGE_LABELS[opportunity.stage] || opportunity.stage} ·{" "}
                      {formatShortDate(opportunity.expectedCloseAt)}
                    </small>
                  </span>
                  <strong>
                    {formatCompactCurrency(opportunity.weightedCommission)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.readinessState}>
          <div className={styles.readinessIcon}>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <h3>Henüz güvenilir bir tutar göstermiyoruz.</h3>
            <p>
              Tahmin üretmek için açık fırsatlarda beklenen kapanış tarihi,
              değer ve komisyon oranı bulunmalı.
            </p>
          </div>
          <div className={styles.coverageTrack}>
            <span style={{ width: `${outlook.dataCoverage}%` }} />
          </div>
          <div className={styles.readinessMeta}>
            <span>{outlook.missingExpectedCloseAt} tarihsiz fırsat</span>
            <span>{outlook.missingFinancials} finansal bilgisi eksik</span>
          </div>
        </div>
      )}

      <div className={styles.methodLine}>
        <span>
          CRM olasılıkları hesaplar; AI yalnızca sonucu yorumlar. Kesin satış
          sözü değildir.
        </span>
        <button onClick={onOpenPipeline} type="button">
          Satış hattını aç
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function Scenario({
  featured = false,
  label,
  value,
}: {
  featured?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className={styles.scenario} data-featured={featured || undefined}>
      <span>{label}</span>
      <strong>{formatCompactCurrency(value)}</strong>
    </div>
  );
}

function DecisionRail({
  alerts,
  onOpen,
}: {
  alerts: Snapshot["criticalAlerts"];
  onOpen: () => void;
}) {
  return (
    <section aria-labelledby="decision-title" className={styles.decisionRail}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>
            <Target aria-hidden="true" />
            CEO karar kutusu
          </span>
          <h2 id="decision-title">Bugün sizden beklenenler</h2>
        </div>
        <span className={styles.decisionCount}>{alerts.length}</span>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.cleanState}>
          <CheckCircle2 aria-hidden="true" />
          <strong>Kritik akış temiz</strong>
          <p>Acil müdahale veya patron onayı bekleyen kayıt yok.</p>
        </div>
      ) : (
        <div className={styles.decisionList}>
          {alerts.slice(0, 4).map((alert, index) => (
            <button key={alert.id} onClick={onOpen} type="button">
              <span className={styles.decisionIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.decisionCopy}>
                <strong>{alert.title}</strong>
                <small>{alert.detail}</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <button className={styles.railButton} onClick={onOpen} type="button">
        Tüm kararları incele
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function PipelineCanvas({
  onOpen,
  stages,
}: {
  onOpen: () => void;
  stages: Snapshot["pipelineStages"];
}) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <section aria-labelledby="pipeline-title" className={styles.dataCanvas}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>
            <ChartNoAxesCombined aria-hidden="true" />
            Satış hattı dağılımı
          </span>
          <h2 id="pipeline-title">Fırsatlar hangi aşamada?</h2>
        </div>
        <strong className={styles.totalFigure}>{total}</strong>
      </div>
      <div className={styles.pipelineBars}>
        {stages.map((stage) => (
          <div className={styles.pipelineRow} key={stage.key}>
            <div>
              <span>{stage.label}</span>
              <strong>{stage.count}</strong>
            </div>
            <div className={styles.pipelineTrack}>
              <span
                style={{
                  width: `${stage.count === 0 ? 0 : Math.max(8, (stage.count / maxCount) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <button className={styles.inlineButton} onClick={onOpen} type="button">
        Fırsatları incele
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function TeamCanvas({
  members,
  onOpen,
}: {
  members: Snapshot["employeePerformance"];
  onOpen: () => void;
}) {
  return (
    <section aria-labelledby="team-title" className={styles.teamCanvas}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionKicker}>
            <Users aria-hidden="true" />
            Ekip nabzı
          </span>
          <h2 id="team-title">İş yükü ve sonuçlar</h2>
        </div>
        <span className={styles.teamCount}>{members.length} aktif</span>
      </div>
      {members.length === 0 ? (
        <p className={styles.emptyCopy}>
          Aktif çalışan performansı bulunamadı.
        </p>
      ) : (
        <div className={styles.teamList}>
          {members.slice(0, 4).map((member) => (
            <div className={styles.teamRow} key={member.id}>
              <span className={styles.avatar} aria-hidden="true">
                {member.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
              </span>
              <span className={styles.memberName}>{member.name}</span>
              <span>
                <strong>{member.completedTasks}</strong>
                <small>tamamlanan</small>
              </span>
              <span>
                <strong>{member.openTasks}</strong>
                <small>açık görev</small>
              </span>
              <span>
                <strong>{member.wonDeals}</strong>
                <small>kazanılan</small>
              </span>
            </div>
          ))}
        </div>
      )}
      <button className={styles.inlineButton} onClick={onOpen} type="button">
        Ekip ayrıntısını aç
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function DestinationGrid({
  onOpenCustomers,
  onOpenPerformance,
  onOpenPipeline,
}: {
  onOpenCustomers: () => void;
  onOpenPerformance: () => void;
  onOpenPipeline: () => void;
}) {
  return (
    <section
      aria-labelledby="destinations-title"
      className={styles.destinationCanvas}
    >
      <div className={styles.destinationHeading}>
        <div>
          <span className={styles.sectionKicker}>
            <BriefcaseBusiness aria-hidden="true" />
            Hızlı geçişler
          </span>
          <h2 id="destinations-title">Ayrıntıya gerektiğinde inin</h2>
        </div>
        <p>CEO görünümünden çalışma alanlarına tek adımda geçin.</p>
      </div>
      <div className={styles.destinationGrid}>
        <button
          className={styles.destinationItem}
          onClick={onOpenCustomers}
          type="button"
        >
          <Users aria-hidden="true" />
          <span>
            <strong>Müşteriler</strong>
            <small>CRM kayıtları</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          className={styles.destinationItem}
          onClick={onOpenPipeline}
          type="button"
        >
          <CircleDollarSign aria-hidden="true" />
          <span>
            <strong>Satış fırsatları</strong>
            <small>Hattı yönetin</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <Link className={styles.destinationItem} href="/fabrika/portfoyler">
          <Building2 aria-hidden="true" />
          <span>
            <strong>Portföyler</strong>
            <small>Aktif stok</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link className={styles.destinationItem} href="/fabrika/takvim">
          <Clock3 aria-hidden="true" />
          <span>
            <strong>Görev ve takvim</strong>
            <small>Kritik tarihler</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <button
          className={styles.destinationItem}
          onClick={onOpenPerformance}
          type="button"
        >
          <ChartNoAxesCombined aria-hidden="true" />
          <span>
            <strong>Ekip performansı</strong>
            <small>İş yükü ve sonuç</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <Link className={styles.destinationItem} href="/fabrika/pazarlamaci">
          <Megaphone aria-hidden="true" />
          <span>
            <strong>Kampanyalar</strong>
            <small>Yayın ve sonuçlar</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function DetailDialog({
  detailView,
  onClose,
  snapshot,
}: {
  detailView: DetailView;
  onClose: () => void;
  snapshot: Snapshot | null;
}) {
  return (
    <Dialog
      open={detailView !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className={styles.dialogSurface}>
        {detailView === "performance" && snapshot && (
          <>
            <DialogHeader>
              <DialogTitle>Ekip performansı</DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                Bu ayın doğrulanmış görev, fırsat ve portföy kayıtları.
              </DialogDescription>
            </DialogHeader>
            {snapshot.employeePerformance.length === 0 ? (
              <p className={styles.dialogEmpty}>
                Aktif çalışan performansı bulunamadı.
              </p>
            ) : (
              <div className={styles.dialogList}>
                {snapshot.employeePerformance.map((member) => (
                  <div className={styles.dialogEntry} key={member.id}>
                    <strong>{member.name}</strong>
                    <div className={styles.dialogStats}>
                      <SmallStat
                        label="Tamamlanan"
                        value={member.completedTasks}
                      />
                      <SmallStat label="Açık görev" value={member.openTasks} />
                      <SmallStat label="Kazanılan" value={member.wonDeals} />
                      <SmallStat
                        label="Yeni portföy"
                        value={member.newProperties}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {detailView === "alerts" && snapshot && (
          <>
            <DialogHeader>
              <DialogTitle>CEO karar kutusu</DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                Yalnız doğrulanmış görev, onay ve teslimat sorunları listelenir.
              </DialogDescription>
            </DialogHeader>
            {snapshot.criticalAlerts.length === 0 ? (
              <div className={styles.dialogClean}>
                <CheckCircle2 aria-hidden="true" />
                <p>Açık kritik kayıt yok.</p>
              </div>
            ) : (
              <div className={styles.dialogList}>
                {snapshot.criticalAlerts.map((alert) => (
                  <div className={styles.alertEntry} key={alert.id}>
                    <AlertTriangle aria-hidden="true" />
                    <span>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {detailView === "report" && snapshot && (
          <>
            <DialogHeader>
              <DialogTitle>AI yönetici brifingi</DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                Şirket kayıtlarından üretilen yönetici özeti; kararlarınızı
                destekler, tek başına işlem yapmaz.
              </DialogDescription>
            </DialogHeader>
            <p className={styles.reportBody}>{snapshot.report}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.smallStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.errorState}>
      <span className={styles.errorIcon}>
        <AlertTriangle aria-hidden="true" />
      </span>
      <h2>Şirket özeti açılamadı</h2>
      <p>{message}</p>
      <Button onClick={onRetry} type="button">
        Yeniden dene
      </Button>
    </section>
  );
}

function CompanyCeoSkeleton() {
  return (
    <div
      aria-label="Şirket özeti yükleniyor"
      className={styles.loadingState}
      role="status"
    >
      <div className={styles.loadingBrief} />
      <div className={styles.loadingMetrics}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={styles.loadingTile} key={index} />
        ))}
      </div>
      <div className={styles.loadingSplit}>
        <div />
        <div />
      </div>
    </div>
  );
}
