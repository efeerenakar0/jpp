import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { assertPublicUrl } from '@/lib/portfolio-connectors';

export const runtime = 'nodejs';

const POSTER_FORMATS = {
  square: { width: 1080, height: 1080, padding: '70px' },
  portrait: { width: 1080, height: 1350, padding: '82px 70px' },
  story: { width: 1080, height: 1920, padding: '110px 82px' },
  landscape: { width: 1200, height: 675, padding: '54px 64px' },
  pin: { width: 1000, height: 1500, padding: '86px 68px' },
} as const;

type PosterFormat = keyof typeof POSTER_FORMATS;

function normalizePosterFormat(value: string | null): PosterFormat {
  return value && value in POSTER_FORMATS ? (value as PosterFormat) : 'square';
}

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { campaignId } = await context.params;
    const campaign = await prisma.adCampaign.findFirst({
      where: { id: campaignId, companyAccountId: principal.account.id },
      include: {
        property: {
          select: { title: true, location: true, price: true, imageUrl: true },
        },
      },
    });
    if (!campaign) return new Response('Poster bulunamadı.', { status: 404 });

    const url = new URL(request.url);
    const format = normalizePosterFormat(url.searchParams.get('format'));
    const download = url.searchParams.get('download') === '1';
    const formatConfig = POSTER_FORMATS[format];
    const size = { width: formatConfig.width, height: formatConfig.height };
    let imageUrl: string | null = null;
    if (campaign.property?.imageUrl) {
      try {
        imageUrl = (await assertPublicUrl(campaign.property.imageUrl)).toString();
      } catch {
        imageUrl = null;
      }
    }
    const template = campaign.posterTemplate || 'SIGNATURE';
    const accent = template === 'BOLD' ? '#f59e0b' : '#10b981';
    const overlay =
      template === 'EDITORIAL'
        ? 'linear-gradient(90deg, rgba(2,6,23,.96) 0%, rgba(2,6,23,.78) 48%, rgba(2,6,23,.2) 100%)'
        : 'linear-gradient(180deg, rgba(2,6,23,.12) 0%, rgba(2,6,23,.38) 42%, rgba(2,6,23,.96) 100%)';
    const price = campaign.property?.price
      ? new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          maximumFractionDigits: 0,
        }).format(campaign.property.price)
      : null;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            height: '100%',
            color: 'white',
            background: '#020617',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              width={size.width}
              height={size.height}
              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', width: '100%', height: '100%', background: 'linear-gradient(135deg,#0f172a,#064e3b)' }} />
          )}
          <div style={{ position: 'absolute', width: '100%', height: '100%', background: overlay }} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: template === 'EDITORIAL' ? 'center' : 'flex-end',
              width: '100%',
              height: '100%',
              padding: formatConfig.padding,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 32 }}>
              <div style={{ width: 52, height: 8, background: accent, borderRadius: 999 }} />
              <div style={{ fontSize: 26, letterSpacing: 6, fontWeight: 700 }}>
                {principal.account.companyName.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', maxWidth: template === 'EDITORIAL' ? '72%' : '92%', fontSize: format === 'story' || format === 'pin' ? 78 : format === 'landscape' ? 56 : 68, lineHeight: 1.04, fontWeight: 800 }}>
              {campaign.posterHeadline || campaign.name}
            </div>
            <div style={{ display: 'flex', marginTop: 26, fontSize: format === 'story' || format === 'pin' ? 38 : format === 'landscape' ? 25 : 30, color: '#d1fae5' }}>
              {[campaign.posterSubline, price].filter(Boolean).join(' · ')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 44, alignSelf: 'flex-start', background: accent, color: '#02120d', padding: '20px 30px', borderRadius: 14, fontSize: 24, fontWeight: 800, letterSpacing: 1 }}>
              {campaign.posterCta || 'DETAYLARI İNCELEYİN'}
            </div>
          </div>
        </div>
      ),
      {
        ...size,
        headers: download
          ? {
              'Content-Disposition': `attachment; filename="jasmine-${campaign.id}-${format}.png"`,
              'Cache-Control': 'private, no-store',
            }
          : { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return new Response(error.message, { status: 401 });
    }
    console.error('[Marketing Poster]:', error);
    return new Response('Poster üretilemedi.', { status: 500 });
  }
}
