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
      </div>

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
