'use client';

import { WandSparkles } from 'lucide-react';
import Link from 'next/link';

import {
  BUSINESS_CEO_MODULES,
  type BusinessCeoModuleDefinition,
} from '@/lib/business-ceo-dashboard';

import { ModuleVisual } from './ModuleVisual';
import type { PortfolioWorkflowStatus } from '../executive-dashboard/usePortfolioWorkflowController';
import styles from './BusinessCeoDashboard.module.css';

function WorkflowCard({
  module,
}: {
  module: BusinessCeoModuleDefinition;
}) {
  return (
    <article className={styles.workflowCard} data-accent={module.accent}>
      <span className={styles.stepBadge} aria-hidden="true">
        {String(module.step).padStart(2, '0')}
      </span>
      <Link
        aria-label={`${module.title} sayfasını aç`}
        className={styles.workflowButton}
        href={module.href}
      >
        <ModuleVisual moduleKey={module.key} />
        <span className={styles.workflowCopy}>
          <strong>{module.title}</strong>
          <small>{module.description}</small>
        </span>
      </Link>
    </article>
  );
}

function Connector({ merge = false }: { merge?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={styles.workflowConnector}
      data-merge={merge || undefined}
    >
      <span>→</span>
    </div>
  );
}

function MobileConnector() {
  return (
    <div aria-hidden="true" className={styles.workflowConnectorVertical}>
      <span>↓</span>
    </div>
  );
}

export function WorkflowBoard({
  onQuickWorkflow,
  workflowStatus,
}: {
  onQuickWorkflow: () => void;
  workflowStatus: PortfolioWorkflowStatus | null;
}) {
  const [portfolio, studio, advertising, marketing] =
    BUSINESS_CEO_MODULES.workflow;

  return (
    <section
      aria-labelledby="business-ceo-workflow-title"
      className={`${styles.panel} ${styles.workflowPanel}`}
    >
      <header className={styles.panelHeader}>
        <div>
          <h1 className={styles.panelTitle} id="business-ceo-workflow-title">
            İş Akışı
          </h1>
          <p className={styles.panelDescription}>
            Portföyünüzü keşiften pazarlamaya tek bir akışta yönetin.
          </p>
        </div>
        <button
          aria-haspopup="dialog"
          className={styles.quickWorkflowButton}
          onClick={onQuickWorkflow}
          type="button"
        >
          <WandSparkles aria-hidden="true" />
          <span className={styles.quickWorkflowCopy}>
            <strong>
              {workflowStatus ? 'Akışa devam et' : 'Hızlı akışı başlat'}
            </strong>
            <small>
              {workflowStatus
                ? `Adım ${workflowStatus.step}/6 · ${workflowStatus.label}`
                : 'Tek pencerede portföyden pazarlamaya'}
            </small>
          </span>
          {workflowStatus ? (
            <span className={styles.quickWorkflowProgress} aria-hidden="true">
              %{workflowStatus.progress}
            </span>
          ) : null}
        </button>
      </header>

      <div className={styles.workflowBody}>
        <div className={styles.workflowDesktop}>
          <div className={styles.sourceStack}>
            <WorkflowCard module={portfolio} />
            <WorkflowCard module={studio} />
          </div>
          <Connector merge />
          <WorkflowCard module={advertising} />
          <Connector />
          <WorkflowCard module={marketing} />
        </div>

        <div className={styles.workflowMobile}>
          {BUSINESS_CEO_MODULES.workflow.map((module, index) => (
            <div key={module.key}>
              <WorkflowCard module={module} />
              {index < BUSINESS_CEO_MODULES.workflow.length - 1 ? (
                <MobileConnector />
              ) : null}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
