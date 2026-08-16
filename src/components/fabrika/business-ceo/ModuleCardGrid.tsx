'use client';

import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

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
    src: '/business-ceo/modules/ai-developer-page-v3.png',
    alt: 'AI Yazılımcı sayfa içi önizlemesi',
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

export function ModuleCardGrid() {
  return (
    <nav aria-label="Business CEO AI modülleri" className={styles.secondaryGrid}>
      {BUSINESS_CEO_MODULES.secondary.map((module) => {
        const image = MODULE_CARD_IMAGES[module.key];

        return (
          <Link
            aria-label={`${module.title} sayfasını aç`}
            className={styles.secondaryCard}
            data-accent={module.accent}
            href={module.href}
            key={module.key}
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
          </Link>
        );
      })}
    </nav>
  );
}
