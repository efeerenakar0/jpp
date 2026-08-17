import { notFound } from 'next/navigation';

import PublicPortfolioSite from '../page';

type PublicSiteSection =
  | 'hakkimizda'
  | 'hizmetler'
  | 'portfoyler'
  | 'blog'
  | 'sik-sorulanlar'
  | 'iletisim';

const PUBLIC_SITE_SECTIONS = new Set<PublicSiteSection>([
  'hakkimizda',
  'hizmetler',
  'portfoyler',
  'blog',
  'sik-sorulanlar',
  'iletisim',
]);

export const dynamic = 'force-dynamic';

export default async function PublicPortfolioSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  if (!PUBLIC_SITE_SECTIONS.has(section as PublicSiteSection)) notFound();
  return PublicPortfolioSite({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({ view: section }),
  });
}
