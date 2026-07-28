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
    const portals = market.portals.map((portal) => ({
      portalId: portal.id,
      portalName: portal.name,
      accountType: portal.accountType,
      note: portal.note,
    }));
    const prompt = `Sen uluslararası gayrimenkul ilanları hazırlayan kıdemli bir editörsün.
Hedef ülke: ${market.country}
Yayın dili: ${market.language}
Şirket: ${principal.account.companyName}
Doğrulanmış portföy verisi: ${JSON.stringify(verifiedProperty)}
Hedef portallar: ${JSON.stringify(portals)}

Her portal için o platformdaki okuyucuya uygun, doğal ve birbirinden farklı bir ilan başlığı, açıklaması ve kısa yayın adımları yaz.
Yalnızca doğrulanmış portföy verisini kullan. Bilinmeyen özellik, yatırım getirisi, vatandaşlık, ikamet, hukuki uygunluk, indirim, teslim tarihi veya portal ücreti uydurma.
Başlık ve açıklamalar ${market.language} dilinde; strateji, uyarılar ve yayın adımları Türkçe olsun.
Yalnızca şu yapıda geçerli JSON döndür:
{"strategy":"...","warnings":["..."],"portalCopies":[{"portalId":"...","title":"...","body":"...","steps":["..."]}]}`;

    const aiResult = await callCompanyMarketingAI(principal.account.id, [
      {
        role: 'system',
        content: 'Yanıtın yalnızca geçerli JSON olsun. Doğrulanmamış veri ve fiyat uydurma.',
      },
      { role: 'user', content: prompt },
    ]);
    const plan = parseInternationalPlan(aiResult.content, fallback, market);

    const campaign = await prisma.adCampaign.create({
      data: {
        companyAccountId: principal.account.id,
        propertyId: property.id,
        name: `${market.flag} ${market.country} · ${property.title}`,
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
      message: `${property.title} için ${market.portals.length} portala özel metin ve yayın rehberi hazırlandı.`,
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
