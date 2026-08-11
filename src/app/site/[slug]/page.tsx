import type { CSSProperties } from 'react';
import { ArrowRight, Building2, MapPin, MessageCircle, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';

import prisma from '@/lib/prisma';
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

export default async function PublicPortfolioSite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const whatsapp = whatsappUrl(workspace.whatsappPhone, workspace.brandName);
  const theme = {
    '--site-primary': workspace.primaryColor,
    '--site-accent': workspace.accentColor,
  } as CSSProperties;
  const socialLinks = [
    ['Instagram', workspace.companyAccount.settings?.instagramUrl],
    ['Facebook', workspace.companyAccount.settings?.facebookUrl],
    ['TikTok', workspace.companyAccount.settings?.tiktokUrl],
    ['X', workspace.companyAccount.settings?.xUrl],
    ['LinkedIn', workspace.companyAccount.settings?.linkedinUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <main className={styles.page} style={theme}>
      <header className={styles.header}>
        <a className={styles.brand} href="#anasayfa">
          {workspace.logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logoData} alt={`${workspace.brandName} logosu`} />
          ) : (
            <span className={styles.brandMark}><Building2 /></span>
          )}
          <strong>{workspace.brandName}</strong>
        </a>
        <nav aria-label="Ana menü">
          <a href="#portfoyler">Portföyler</a>
          <a href="#iletisim">İletişim</a>
        </nav>
      </header>

      <section className={styles.hero} id="anasayfa">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>GÜNCEL GAYRİMENKUL PORTFÖYLERİ</span>
          <h1>Yeni yaşam alanınız burada başlıyor.</h1>
          <p>
            Yetkisi doğrulanmış güncel portföyleri inceleyin, ayrıntılar için
            doğrudan bizimle iletişime geçin.
          </p>
          <a className={styles.heroButton} href="#portfoyler">
            Portföyleri keşfedin <ArrowRight />
          </a>
        </div>
        <div className={styles.heroStat}>
          <strong>{properties.length}</strong>
          <span>yayındaki portföy</span>
          <small>Business CEO AI ile otomatik güncellenir</small>
        </div>
      </section>

      <section className={styles.portfolioSection} id="portfoyler">
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
      </section>

      <footer className={styles.footer} id="iletisim">
        <div>
          <span className={styles.eyebrow}>İLETİŞİM</span>
          <h2>{workspace.brandName}</h2>
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
