import type { MetadataRoute } from 'next';

import { industriesContent as englishIndustries } from '@/marketing/content/en/industries';
import { industriesContent as turkishIndustries } from '@/marketing/content/tr/industries';
import { LEGAL_SLUGS } from '@/marketing/content/legal';
import { absoluteSiteUrl } from '@/marketing/seo/site';

type LocalizedRoutePair = {
  readonly en: string;
  readonly tr: string;
  readonly priority: number;
  readonly changeFrequency: 'weekly' | 'monthly' | 'yearly';
};

const coreRoutes: readonly LocalizedRoutePair[] = [
  { en: '/', tr: '/tr', priority: 1, changeFrequency: 'weekly' },
  { en: '/realestate', tr: '/tr/realestate', priority: 0.9, changeFrequency: 'weekly' },
  { en: '/contact', tr: '/tr/contact', priority: 0.8, changeFrequency: 'monthly' },
];

const industryRoutes: readonly LocalizedRoutePair[] = englishIndustries.sectors
  .filter((sector) => sector.status !== 'flagship')
  .map((sector) => {
    const localizedSector = turkishIndustries.sectors.find(
      (candidate) => candidate.id === sector.id,
    );

    if (!localizedSector) {
      throw new Error(`Missing Turkish industry route for ${sector.id}.`);
    }

    return {
      en: sector.route,
      tr: localizedSector.route,
      priority: 0.65,
      changeFrequency: 'monthly' as const,
    };
  });

const legalRoutes: readonly LocalizedRoutePair[] = LEGAL_SLUGS.map((slug) => ({
  en: `/legal/${slug}`,
  tr: `/tr/legal/${slug}`,
  priority: 0.35,
  changeFrequency: 'yearly' as const,
}));

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [...coreRoutes, ...industryRoutes, ...legalRoutes].flatMap((route) => {
    const englishUrl = absoluteSiteUrl(route.en);
    const turkishUrl = absoluteSiteUrl(route.tr);
    const alternates = {
      languages: {
        en: englishUrl,
        tr: turkishUrl,
      },
    };

    return [
      {
        url: englishUrl,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates,
      },
      {
        url: turkishUrl,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates,
      },
    ];
  });
}
