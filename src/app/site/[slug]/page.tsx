import type { CSSProperties } from 'react';
import { ArrowRight, Building2, MapPin, MessageCircle, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';

import prisma from '@/lib/prisma';
import {
  getDeveloperTheme,
  parseDeveloperSiteContent,
} from '@/lib/developer-site';
import { readDeveloperSiteSettings } from '@/lib/developer-site-storage';
import { publicationEligibilityWhere } from '@/lib/property-publication';
import styles from './PublicPortfolioSite.module.css';

export const dynamic = 'force-dynamic';

function formatPrice(value: number | null) {
  if (value === null) return 'Fiyat için iletişime geçin';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function whatsappUrl(phone: string | null, brandName: string) {
  const normalized = phone?.replace(/\D/g, '') || '';
  if (!normalized) return null;
  const text = encodeURIComponent(`Merhaba ${brandName}, portföyleriniz hakkında bilgi almak istiyorum.`);
  return `https://wa.me/${normalized}?text=${text}`;
}

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

async function renderPublicPortfolioSite({
  slug,
  view,
  section,
}: {
  slug: string;
  view?: string;
  section?: PublicSiteSection;
}) {
  const sectionVisible = (target: PublicSiteSection) => !section || section === target;
  const workspace = await prisma.developerWorkspace.findUnique({
    where: { temporarySlug: slug },
    include: {
      companyAccount: {
        select: {
          id: true,
          settings: {
            select: {
              instagramUrl: true,
              facebookUrl: true,
              tiktokUrl: true,
              xUrl: true,
              linkedinUrl: true,
            },
          },
        },
      },
    },
  });

  if (!workspace || workspace.siteStatus !== 'PUBLISHED') notFound();
  const siteHref = (target?: PublicSiteSection) => {
    if (workspace.customHostname) return target ? `/${target}` : '/';
    return target ? `/site/${slug}/${target}` : `/site/${slug}`;
  };

  const properties = await prisma.crmProperty.findMany({
    where: publicationEligibilityWhere(workspace.companyAccount.id, new Date()),
    select: {
      id: true,
      title: true,
      location: true,
      price: true,
      roomCount: true,
      area: true,
      propertyType: true,
      listingType: true,
      description: true,
      imageUrl: true,
      media: {
        where: { archivedAt: null, mediaType: 'PHOTO' },
        select: { url: true, isCover: true, sortOrder: true },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  });

  const siteSettings = await readDeveloperSiteSettings(workspace.companyAccount.id);
  const whatsapp = whatsappUrl(workspace.whatsappPhone, workspace.brandName);
  const selectedTheme = getDeveloperTheme(siteSettings?.selectedTheme);
  const content = parseDeveloperSiteContent(
    siteSettings?.siteContent,
    workspace.brandName,
  );
  const isFullWebsite = workspace.websiteMode === 'NEW';
  const portfolioOnly = view === 'portfoyler' || section === 'portfoyler';
  const portfolioHref = siteHref('portfoyler');
  const theme = {
    '--site-primary': workspace.primaryColor,
    '--site-accent': workspace.accentColor,
    '--site-bg': selectedTheme.colors.background,
    '--site-surface': selectedTheme.colors.surface,
    '--site-ink': selectedTheme.colors.ink,
    '--site-muted': selectedTheme.colors.muted,
    '--site-theme-accent': selectedTheme.colors.accent,
    '--site-accent-soft': selectedTheme.colors.accentSoft,
  } as CSSProperties;
  const socialLinks = [
    ['Instagram', workspace.companyAccount.settings?.instagramUrl],
    ['Facebook', workspace.companyAccount.settings?.facebookUrl],
    ['TikTok', workspace.companyAccount.settings?.tiktokUrl],
    ['X', workspace.companyAccount.settings?.xUrl],
    ['LinkedIn', workspace.companyAccount.settings?.linkedinUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const heroImageUrl = properties[0]?.media[0]?.url || properties[0]?.imageUrl;

  return (
    <main
      className={styles.page}
      data-layout={selectedTheme.layout}
      data-theme={selectedTheme.id}
      style={theme}
    >
      <header className={styles.header}>
        <a
          className={styles.brand}
          href={siteHref()}
        >
          {workspace.logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logoData} alt={`${workspace.brandName} logosu`} />
          ) : (
            <span className={styles.brandMark}><Building2 /></span>
          )}
          <strong>{workspace.brandName}</strong>
        </a>
        <nav aria-label="Ana menü">
          {isFullWebsite && content.about.enabled && <a href={siteHref('hakkimizda')}>Hakkımızda</a>}
          {isFullWebsite && content.services.enabled && <a href={siteHref('hizmetler')}>Hizmetler</a>}
          <a href={portfolioHref}>Portföyler</a>
          {isFullWebsite && content.blog.enabled && <a href={siteHref('blog')}>Blog</a>}
          <a href={siteHref('iletisim')}>İletişim</a>
        </nav>
      </header>

      {!portfolioOnly && !section && <section className={styles.hero} id="anasayfa">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{content.hero.eyebrow}</span>
          <h1>{content.hero.title}</h1>
          <p>{content.hero.description}</p>
          <a className={styles.heroButton} href={portfolioHref}>
            {content.hero.buttonLabel} <ArrowRight />
          </a>
        </div>
        <div className={styles.heroVisual}>
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImageUrl} alt={`${workspace.brandName} seçili portföyü`} />
          ) : (
            <div className={styles.heroPlaceholder}><Building2 /></div>
          )}
          <div className={styles.heroStat}>
            <strong>{properties.length}</strong>
            <span>yayındaki portföy</span>
            <small>Business CEO AI ile otomatik güncellenir</small>
          </div>
        </div>
      </section>}

      {!portfolioOnly && sectionVisible('hakkimizda') && isFullWebsite && content.about.enabled && (
        <section className={styles.aboutSection} id="hakkimizda">
          <div className={styles.sectionIndex}>01 / HAKKIMIZDA</div>
          <div>
            <span className={styles.eyebrow}>BİZİ TANIYIN</span>
            <h2>{content.about.title}</h2>
          </div>
          <p>{content.about.body}</p>
        </section>
      )}

      {!portfolioOnly && sectionVisible('hizmetler') && isFullWebsite && content.services.enabled && (
        <section className={styles.servicesSection} id="hizmetler">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>HİZMETLER</span>
              <h2>{content.services.title}</h2>
            </div>
            <p>{content.services.intro}</p>
          </div>
          <div className={styles.serviceGrid}>
            {content.services.items.map((item, index) => (
              <article key={`${index}-${item.title}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {sectionVisible('portfoyler') && <section className={styles.portfolioSection} id="portfoyler">
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.eyebrow}>PORTFÖYLER</span>
            <h2>Size uygun seçenekler</h2>
          </div>
          <p>Yalnızca aktif ve yayın yetkisi doğrulanmış kayıtlar gösterilir.</p>
        </div>

        {properties.length ? (
          <div className={styles.grid}>
            {properties.map((property) => {
              const imageUrl = property.media[0]?.url || property.imageUrl;
              return (
                <article className={styles.card} key={property.id}>
                  <div className={styles.cardImage}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" />
                    ) : (
                      <Building2 />
                    )}
                    <span>{property.listingType === 'RENT' ? 'Kiralık' : 'Satılık'}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.price}>{formatPrice(property.price)}</p>
                    <h3>{property.title}</h3>
                    {property.location && <p className={styles.location}><MapPin /> {property.location}</p>}
                    <div className={styles.facts}>
                      {property.roomCount && <span>{property.roomCount}</span>}
                      {property.area && <span>{property.area} m²</span>}
                      {property.propertyType && <span>{property.propertyType}</span>}
                    </div>
                    {whatsapp && (
                      <a href={whatsapp} target="_blank" rel="noreferrer">
                        Bilgi alın <MessageCircle />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <Building2 />
            <h3>Yeni portföyler hazırlanıyor</h3>
            <p>Aktif portföyler yayınlandığı anda bu sayfada otomatik görünecek.</p>
          </div>
        )}
      </section>}

      {!portfolioOnly && sectionVisible('blog') && isFullWebsite && content.blog.enabled && (
        <section className={styles.blogSection} id="blog">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>BLOG</span>
              <h2>{content.blog.title}</h2>
            </div>
            <p>{content.blog.intro}</p>
          </div>
          <div className={styles.blogGrid}>
            {content.blog.posts.map((post, index) => (
              <article key={post.id}>
                <span>{String(index + 1).padStart(2, '0')} · REHBER</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {!portfolioOnly && sectionVisible('sik-sorulanlar') && isFullWebsite && content.faq.enabled && (
        <section className={styles.faqSection} id="sik-sorulanlar">
          <div>
            <span className={styles.eyebrow}>SIK SORULANLAR</span>
            <h2>{content.faq.title}</h2>
          </div>
          <div className={styles.faqList}>
            {content.faq.items.map((item, index) => (
              <details key={`${index}-${item.question}`}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer} id="iletisim">
        <div>
          <span className={styles.eyebrow}>İLETİŞİM</span>
          <h2>{content.contact.title}</h2>
          <p>{content.contact.description}</p>
          {workspace.address && <p><MapPin /> {workspace.address}</p>}
        </div>
        <div className={styles.contactLinks}>
          {workspace.contactPhone && <a href={`tel:${workspace.contactPhone}`}><Phone /> {workspace.contactPhone}</a>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp&apos;tan yazın</a>}
          {workspace.contactEmail && <a href={`mailto:${workspace.contactEmail}`}>{workspace.contactEmail}</a>}
        </div>
        {socialLinks.length > 0 && (
          <div className={styles.socialLinks}>
            {socialLinks.map(([label, url]) => <a href={url} key={label} target="_blank" rel="noreferrer">{label}</a>)}
          </div>
        )}
      </footer>
    </main>
  );
}

export default async function PublicPortfolioSite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view } = await searchParams;
  const section = PUBLIC_SITE_SECTIONS.has(view as PublicSiteSection)
    ? view as PublicSiteSection
    : undefined;
  return renderPublicPortfolioSite({ slug, view, section });
}
