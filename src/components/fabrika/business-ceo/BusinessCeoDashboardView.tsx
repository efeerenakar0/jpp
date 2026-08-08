'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CheckSquare2,
  Clock3,
  House,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

import { PortfolioWorkflowDialog } from '@/components/fabrika/executive-dashboard/PortfolioWorkflowContent';
import { usePortfolioWorkflowController } from '@/components/fabrika/executive-dashboard/usePortfolioWorkflowController';
import type { BusinessCeoModuleDefinition } from '@/lib/business-ceo-dashboard';
import type { PortfolioWorkflowLaunchIntent } from '@/lib/portfolio-workflow-intent';

import { ModuleCardGrid } from './ModuleCardGrid';
import { ModuleLaunchDialog } from './ModuleLaunchDialog';
import { SalesExpertPanel } from './SalesExpertPanel';
import type {
  AssistantMetrics,
  SalesAppointment,
  SalesConversation,
  SalesMessage,
  WhatsAppStatus,
} from './sales-data';
import styles from './BusinessCeoDashboard.module.css';
import { WorkflowBoard } from './WorkflowBoard';

export type BusinessCeoDashboardViewProps = {
  appointments: readonly SalesAppointment[];
  conversations: readonly SalesConversation[];
  error: string | null;
  isOwner: boolean;
  loading: boolean;
  metrics: AssistantMetrics | null;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onRefresh: () => void;
  onSendMessage: (
    conversationId: string,
    message: string
  ) => Promise<SalesMessage | undefined | void>;
  whatsappStatus: WhatsAppStatus | null;
  whatsappError?: string | null;
  initialWorkflowIntent?: PortfolioWorkflowLaunchIntent | null;
};

function DashboardStatusBar({
  error,
  loading,
  whatsappError,
}: {
  error: string | null;
  loading: boolean;
  whatsappError: string | null;
}) {
  const status = loading
    ? { label: 'Sistem durumu: Kontrol ediliyor', tone: 'checking' }
    : error || whatsappError
      ? { label: 'Sistem durumu: Kontrol gerekli', tone: 'warning' }
      : { label: 'Sistem durumu: Tüm servisler çalışıyor', tone: 'healthy' };

  return (
    <footer
      aria-label="Business CEO AI sistem durumu"
      className={styles.statusBar}
    >
      <div className={styles.statusBarInner}>
        <div aria-label="Business CEO AI | Real Estate" className={styles.footerBrand}>
          <span>BUSINESS CEO</span>
          <span className={styles.footerAi}>AI</span>
          <span aria-hidden="true" className={styles.footerDivider} />
          <span className={styles.footerSector}>Real Estate</span>
        </div>
        <div
          aria-live="polite"
          className={styles.systemStatus}
          data-status={status.tone}
          role="status"
        >
          <span aria-hidden="true" className={styles.systemStatusDot} />
          {status.label}
        </div>
      </div>
    </footer>
  );
}

function metricValue(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('tr-TR').format(value)
    : '—';
}

function DashboardMetricStrip({ metrics }: { metrics: AssistantMetrics | null }) {
  const items = [
    {
      label: 'Sitede Yayında',
      hint: 'Aktif portföyünüz',
      value: null,
      icon: House,
    },
    {
      label: 'Yeni WhatsApp Mesajı',
      hint: 'Okunmamış sohbet',
      value: metrics?.incomingMessages,
      icon: MessageCircle,
    },
    {
      label: 'Yanıt Bekleyen',
      hint: 'Müşteri talebi',
      value: metrics?.pendingAppointments,
      icon: Clock3,
    },
    {
      label: 'Bugünkü Randevu',
      hint: 'Planlanan görüşme',
      value: metrics?.approvedToday,
      icon: CalendarDays,
    },
    {
      label: 'Aktif AI İşlemi',
      hint: 'Arka planda çalışıyor',
      value: metrics?.outgoingMessages,
      icon: Sparkles,
    },
    {
      label: 'Açık Görev',
      hint: 'Takip bekliyor',
      value: metrics?.handoffConversations,
      icon: CheckSquare2,
    },
  ] as const;

  return (
    <dl aria-label="Canlı operasyon özeti" className={styles.metricStrip}>
      {items.map(({ label, hint, value, icon: Icon }) => (
        <div className={styles.metricStripItem} key={label}>
          <Icon aria-hidden="true" />
          <dd>{metricValue(value)}</dd>
          <div>
            <dt>{label}</dt>
            <span>{hint}</span>
          </div>
        </div>
      ))}
    </dl>
  );
}

const REFERENCE_BRANDS = [
  ['NOVA', 'REALTY'],
  ['VISTA', 'HOMES'],
  ['URBANCORE', ''],
  ['PRIME', 'ESTATE'],
  ['BLUEHARBOR', ''],
] as const;

function ReferenceRibbon() {
  return (
    <div aria-label="Örnek iş ortakları" className={styles.referenceRibbon}>
      {REFERENCE_BRANDS.map(([name, suffix], index) => (
        <div className={styles.referenceBrand} key={name}>
          <span aria-hidden="true" className={styles.referenceMark} data-mark={index + 1} />
          <span>
            <strong>{name}</strong>
            {suffix ? <small>{suffix}</small> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BusinessCeoDashboardView({
  appointments,
  conversations,
  error,
  isOwner,
  loading,
  metrics,
  onDeleteConversation,
  onRefresh,
  onSendMessage,
  whatsappStatus,
  whatsappError = null,
  initialWorkflowIntent = null,
}: BusinessCeoDashboardViewProps) {
  const [selectedModule, setSelectedModule] =
    useState<BusinessCeoModuleDefinition | null>(null);
  const workflow = usePortfolioWorkflowController({
    initialIntent: initialWorkflowIntent,
  });

  return (
    <div className={styles.dashboard}>
      <div className={styles.content}>
        <div className={styles.primaryGrid}>
          <WorkflowBoard
            onQuickWorkflow={workflow.resumeWorkflow}
            onSelect={setSelectedModule}
            workflowStatus={workflow.status}
          />
          <SalesExpertPanel
            appointments={appointments}
            conversations={conversations}
            error={error}
            isOwner={isOwner}
            loading={loading}
            metrics={metrics}
            onDeleteConversation={onDeleteConversation}
            onRefresh={onRefresh}
            onSendMessage={onSendMessage}
            whatsappStatus={whatsappStatus}
            whatsappError={whatsappError}
          />
        </div>
        <DashboardMetricStrip metrics={metrics} />
        <ModuleCardGrid onSelect={setSelectedModule} />
        <ReferenceRibbon />
      </div>

      <DashboardStatusBar
        error={error}
        loading={loading}
        whatsappError={whatsappError}
      />

      <ModuleLaunchDialog
        module={selectedModule}
        onOpenChange={(open) => {
          if (!open) setSelectedModule(null);
        }}
      />
      <PortfolioWorkflowDialog
        draft={workflow.draft}
        entryMode={workflow.entryMode}
        onAction={workflow.onAction}
        onClose={workflow.onClose}
        onContinue={workflow.onContinue}
        onFilesSelected={workflow.onFilesSelected}
        onOpenChange={workflow.onOpenChange}
        onRetryMedia={workflow.onRetryMedia}
        open={workflow.dialogOpen}
      />
    </div>
  );
}
