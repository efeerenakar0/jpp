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
  onRefresh: () => void;
  onSendMessage: (
    conversationId: string,
    message: string
  ) => Promise<SalesMessage | undefined | void>;
  whatsappStatus: WhatsAppStatus | null;
  whatsappError?: string | null;
  initialWorkflowIntent?: PortfolioWorkflowLaunchIntent | null;
};

export function BusinessCeoDashboardView({
  appointments,
  conversations,
  error,
  isOwner,
  loading,
  metrics,
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
            onRefresh={onRefresh}
            onSendMessage={onSendMessage}
            whatsappStatus={whatsappStatus}
            whatsappError={whatsappError}
          />
        </div>
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
