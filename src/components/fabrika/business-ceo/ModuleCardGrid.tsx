'use client';

import { ArrowUpRight } from 'lucide-react';

import {
  BUSINESS_CEO_MODULES,
  type BusinessCeoModuleDefinition,
} from '@/lib/business-ceo-dashboard';

import { ModuleVisual } from './ModuleVisual';
import styles from './BusinessCeoDashboard.module.css';

export function ModuleCardGrid({
  onSelect,
}: {
  onSelect: (module: BusinessCeoModuleDefinition) => void;
}) {
  return (
    <nav aria-label="Business CEO AI modülleri" className={styles.secondaryGrid}>
      {BUSINESS_CEO_MODULES.secondary.map((module) => (
        <button
          aria-haspopup="dialog"
          aria-label={`${module.title} ayrıntılarını aç`}
          className={styles.secondaryCard}
          data-accent={module.accent}
          key={module.key}
          onClick={() => onSelect(module)}
          type="button"
        >
          <ModuleVisual compact moduleKey={module.key} />
          <span className={styles.secondaryCopy}>
            <strong>{module.title}</strong>
            <small>{module.description}</small>
            <ArrowUpRight aria-hidden="true" className={styles.secondaryArrow} />
            <span className="sr-only">{module.actionLabel}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
