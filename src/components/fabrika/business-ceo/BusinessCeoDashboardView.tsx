'use client';

import { useState } from 'react';

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
            metrics={metrics}
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
        <ModuleCardGrid onSelect={setSelectedModule} />
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
