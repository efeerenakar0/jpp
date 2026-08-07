'use client';

import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

import {
  BUSINESS_CEO_MODULES,
  type BusinessCeoModuleDefinition,
} from '@/lib/business-ceo-dashboard';

import { ModuleVisual } from './ModuleVisual';
import styles from './BusinessCeoDashboard.module.css';

const MODULE_CARD_IMAGES: Partial<
  Record<
    BusinessCeoModuleDefinition['key'],
    { src: string; alt: string }
  >
> = {
  developer: {
    src: '/business-ceo/modules/ai-developer.png',
    alt: 'AI Yazılımcı modül görseli',
  },
  'partner-finder': {
    src: '/business-ceo/modules/ai-partner-finder.png',
    alt: 'AI Partner Bulucu modül görseli',
  },
  'authorized-pool': {
    src: '/business-ceo/modules/ai-authorized-portfolio-pool.png',
    alt: 'AI Yetkili Portföy Havuzu modül görseli',
  },
  'deed-tracking': {
    src: '/business-ceo/modules/ai-deed-tracking.png',
    alt: 'AI Tapu Takip modül görseli',
  },
  'company-ceo': {
    src: '/business-ceo/modules/ai-company-ceo.png',
    alt: 'AI Şirket CEO modül görseli',
  },
};

export function ModuleCardGrid({
  onSelect,
}: {
  onSelect: (module: BusinessCeoModuleDefinition) => void;
}) {
  return (
    <nav aria-label="Business CEO AI modülleri" className={styles.secondaryGrid}>
      {BUSINESS_CEO_MODULES.secondary.map((module) => {
        const image = MODULE_CARD_IMAGES[module.key];

        return (
          <button
            aria-haspopup="dialog"
            aria-label={`${module.title} ayrıntılarını aç`}
            className={styles.secondaryCard}
            data-accent={module.accent}
            key={module.key}
            onClick={() => onSelect(module)}
            type="button"
          >
            {image ? (
              <span className={styles.moduleImageFrame}>
                <Image
                  alt={image.alt}
                  className={styles.moduleImage}
                  fill
                  sizes="(min-width: 1120px) 20vw, (min-width: 640px) 50vw, 100vw"
                  src={image.src}
                />
              </span>
            ) : (
              <ModuleVisual compact moduleKey={module.key} />
            )}
            <span className={styles.secondaryCopy}>
              <strong>{module.title}</strong>
              <small>{module.description}</small>
              <ArrowUpRight aria-hidden="true" className={styles.secondaryArrow} />
              <span className="sr-only">{module.actionLabel}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
