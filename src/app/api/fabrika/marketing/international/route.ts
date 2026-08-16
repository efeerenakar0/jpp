import {
  CrmPropertyStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildInternationalFallback,
  getInternationalMarket,
  getInternationalPortal,
  parseInternationalPlan,
} from '@/lib/international-marketing';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { callCompanyMarketingAI } from '@/lib/marketing-ai';
import prisma from '@/lib/prisma';

const requestSchema = z.object({
  propertyId: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  portalId: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Yurt dışı kampanya bilgileri geçersiz.' },
        { status: 400 }
      );
    }

    const market = getInternationalMarket(parsed.data.countryCode);
    if (!market) {
      return NextResponse.json({ error: 'Desteklenen bir ülke seçin.' }, { status: 400 });
    }
    const portal = getInternationalPortal(market, parsed.data.portalId);
    if (!portal) {
      return NextResponse.json(
        { error: 'Seçilen portal bu ülke için desteklenmiyor.' },
        { status: 400 },
      );
    }
    if (portal.eligibility === 'unsupported') {
      return NextResponse.json(
        {
          error:
            'Bu portal Türkiye’deki portföyler için uygun değil. Sistem tarafından önerilen başka bir kanalı seçin.',
        },
        { status: 400 },
      );
    }

    const property = await prisma.crmProperty.findFirst({
      where: {
        id: parsed.data.propertyId,
        companyAccountId: principal.account.id,
        status: { in: [CrmPropertyStatus.ACTIVE, CrmPropertyStatus.RESERVED] },
      },
    });
    if (!property) {
      return NextResponse.json(
        { error: 'Aktif portföy bulunamadı veya bu şirkete ait değil.' },
        { status: 404 }
      );
    }

    const fallback = buildInternationalFallback({
      companyName: principal.account.companyName,
      property,
      market,
      portal,
    });
    const verifiedProperty = {
      title: property.title,
      referenceCode: property.referenceCode,
      location: property.location,
      price: property.price,
      roomCount: property.roomCount,
      area: property.area,
      description: property.description,
    };
    const portalRules = {
      portalId: portal.id,
      portalName: portal.name,
      accountType: portal.accountType,
      note: portal.note,
      eligibility: portal.eligibility,
      publishMode: portal.publishMode,
      eligibilityNote: portal.eligibilityNote,
      titleLimit: portal.titleLimit,
      descriptionLimit: portal.descriptionLimit,
      listingOrder: portal.listingOrder,
      requiredFields: portal.requiredFields,
      imageGuidance: portal.imageGuidance,
      mediaRules: portal.mediaRules,
    };
    const marketPlaybook = {
      sourceCurrency: 'TRY',
      portalCurrencyContext: market.currency,
      timezone: market.timezone,
      measurementSystem: market.measurementSystem,
      buyerFocus: market.buyerFocus,
      recommendedSocialChannels: market.socialChannels,
    };
    const prompt = `Sen uluslararası gayrimenkul ilanları hazırlayan kıdemli bir editörsün.
Hedef ülke: ${market.country}
Yayın dili: ${market.language}
Şirket: ${principal.account.companyName}
Doğrulanmış portföy verisi: ${JSON.stringify(verifiedProperty)}
Ülke oyun planı: ${JSON.stringify(marketPlaybook)}
Seçilen tek portal: ${JSON.stringify(portalRules)}

Yalnız seçilen portal için o platformdaki okuyucuya uygun, doğal bir ilan başlığı, açıklaması ve kısa yayın adımları yaz.
Bu tek portal metninin Türkçe geri çevirisini de yaz. Ayrıca ülke için önerilen her sosyal kanalın amacı, doğru görsel formatı, içerik açısı, yerel dilde CTA'sı ve yerel saatle test edilecek yayın aralığını ayrı hazırla.
Yalnızca doğrulanmış portföy verisini kullan. Bilinmeyen özellik, yatırım getirisi, vatandaşlık, ikamet, hukuki uygunluk, indirim, teslim tarihi veya portal ücreti uydurma.
Kaynak fiyat TRY'dir. "Portal para birimi bağlamı" yalnızca gelecekteki yayın kontrolü içindir. Döviz kuru verilmediği için para sembolünü değiştirme, kur dönüşümü yapma ve yabancı para tutarı uydurma; fiyatı TRY olarak koru.
Portal yalnızca kampanya modundaysa portal ilanı vaat etme; yerel dilde açılış sayfası, reklam ve uygunluk doğrulama adımları hazırla.
Başlık ve açıklamalar ${market.language} dilinde; strateji, uyarılar ve yayın adımları Türkçe olsun.
Yalnızca şu yapıda geçerli JSON döndür:
{"strategy":"...","warnings":["..."],"portalCopies":[{"portalId":"...","title":"...","body":"...","titleTr":"...","bodyTr":"...","steps":["..."]}],"socialPlan":{"channels":[{"channel":"...","objective":"...","format":"...","contentAngle":"...","localCta":"...","publishingWindow":"..."}],"complianceNotes":["..."]}}`;

    const aiResult = await callCompanyMarketingAI(principal.account.id, [
      {
        role: 'system',
        content: 'Yanıtın yalnızca geçerli JSON olsun. Doğrulanmamış veri ve fiyat uydurma.',
      },
      { role: 'user', content: prompt },
    ]);
    const plan = parseInternationalPlan(
      aiResult.content,
      fallback,
      market,
      portal,
      property.price,
    );

    const campaign = await prisma.adCampaign.create({
      data: {
        companyAccountId: principal.account.id,
        propertyId: property.id,
        name: `${market.flag} ${market.country} · ${portal.name} · ${property.title}`,
        description: plan.strategy,
        type: 'international',
        objective: 'Yurt dışı ilan yayını',
        audience: `${market.country} alıcıları`,
        tone: 'professional',
        status: 'DRAFT',
        generatedBy: aiResult.provider,
        generatedModel: aiResult.model,
        internationalPlan: plan as unknown as Prisma.InputJsonValue,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            imageUrl: true,
            referenceCode: true,
          },
        },
        adCopies: true,
      },
    });

    await createCompanyNotification({
      companyAccountId: principal.account.id,
      type: NotificationType.AD_COPY_READY,
      title: `${market.country} ilan planı hazır`,
      message: `${property.title} için yalnız ${portal.name} kurallarına uygun metin ve yayın rehberi hazırlandı.`,
      link: '/fabrika/pazarlamaci',
      important: false,
      dedupeKey: `international-campaign-ready:${campaign.id}`,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[International Marketing POST]:', error);
    return NextResponse.json(
      { error: 'Yurt dışı ilan planı hazırlanamadı.' },
      { status: 500 }
    );
  }
}
