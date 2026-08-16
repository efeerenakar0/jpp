import {
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Code2,
  FileCheck2,
  Handshake,
  Images,
  Megaphone,
  Network,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import Image from 'next/image';

import type { BusinessCeoModuleKey } from '@/lib/business-ceo-dashboard';

import styles from './BusinessCeoDashboard.module.css';

const iconMap = {
  'portfolio-specialist': BriefcaseBusiness,
  studio: Images,
  'advertising-design': Video,
  'marketing-specialist': Megaphone,
  developer: Code2,
  'partner-finder': Handshake,
  'authorized-pool': ShieldCheck,
  'deed-tracking': FileCheck2,
  'company-ceo': ChartNoAxesCombined,
} satisfies Record<BusinessCeoModuleKey, typeof Code2>;

const orbitIcons: Partial<Record<BusinessCeoModuleKey, typeof Code2[]>> = {
  'portfolio-specialist': [Building2, Sparkles, Images],
  'marketing-specialist': [Network, ChartNoAxesCombined, Megaphone],
  'partner-finder': [Network, Handshake, Building2],
  'authorized-pool': [Building2, ShieldCheck, Network],
};

const workflowImages: Partial<Record<BusinessCeoModuleKey, string>> = {
  'advertising-design': '/business-ceo/modules/ai-advertising-page-v3.png',
  'marketing-specialist': '/business-ceo/modules/ai-marketing-page-v3.png',
};

export function ModuleVisual({
  moduleKey,
  compact = false,
}: {
  moduleKey: BusinessCeoModuleKey;
  compact?: boolean;
}) {
  const Icon = iconMap[moduleKey];
  const satellites = orbitIcons[moduleKey] || [Sparkles, Building2, Network];
  const workflowImage = !compact ? workflowImages[moduleKey] : undefined;

  return (
    <span
      aria-hidden="true"
      className={compact ? styles.moduleVisualCompact : styles.moduleVisual}
      data-module={moduleKey}
    >
      {workflowImage ? (
        <Image
          alt=""
          className={styles.moduleVisualImage}
          fill
          sizes="(min-width: 1120px) 22vw, 100vw"
          src={workflowImage}
        />
      ) : null}
      <span className={styles.moduleGrid} />
      <span className={styles.moduleGlow} />
      <span className={styles.moduleCore}>
        <Icon />
      </span>
      {!compact
        ? satellites.slice(0, 3).map((Satellite, index) => (
            <span
              className={styles.moduleSatellite}
              data-position={index + 1}
              key={`${moduleKey}-${index}`}
            >
              <Satellite />
            </span>
          ))
        : null}
    </span>
  );
}
