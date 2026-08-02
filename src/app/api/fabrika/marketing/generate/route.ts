import {
  AdPlatform,
  CrmPropertyStatus,
  NotificationType,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createCompanyNotification } from "@/lib/fabrika-notifications";
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from "@/lib/fabrika-session";
import { callCompanyMarketingAI } from "@/lib/marketing-ai";
import {
  deterministicCampaign,
  parseGeneratedCampaign,
} from "@/lib/marketing-content";
import {
  marketingChannelGuidance,
  normalizeMarketingChannels,
} from "@/lib/marketing-channels";

const requestSchema = z
  .object({
    type: z.enum(["listing", "brand"]).default("listing"),
    propertyId: z.string().trim().min(1).optional(),
    listingId: z.string().trim().min(1).optional(),
    objective: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .default("Nitelikli talep toplama"),
    audience: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .default("Bölgedeki alıcı ve yatırımcılar"),
    tone: z.enum(["professional", "warm", "premium"]).default("professional"),
    posterTemplate: z
      .enum(["SIGNATURE", "EDITORIAL", "BOLD"])
      .default("SIGNATURE"),
    targetUrl: z.string().url().max(1000).optional().or(z.literal("")),
    channels: z.array(z.nativeEnum(AdPlatform)).max(20).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "listing" && !value.propertyId && !value.listingId) {
      context.addIssue({
        code: "custom",
        path: ["propertyId"],
        message: "Portföy kampanyası için bir portföy seçin.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || "Kampanya bilgileri geçersiz.",
        },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const channels = normalizeMarketingChannels(input.channels);
    const propertyId = input.propertyId || input.listingId;
    const property =
      input.type === "listing" && propertyId
        ? await prisma.crmProperty.findFirst({
            where: {
              id: propertyId,
              companyAccountId: principal.account.id,
              status: {
                in: [CrmPropertyStatus.ACTIVE, CrmPropertyStatus.RESERVED],
              },
            },
          })
        : null;
    if (input.type === "listing" && !property) {
      return NextResponse.json(
        { error: "Aktif portföy bulunamadı veya bu şirkete ait değil." },
        { status: 404 },
      );
    }

    const fallback = deterministicCampaign({
      companyName: principal.account.companyName,
      property,
      objective: input.objective,
      audience: input.audience,
      tone: input.tone,
      targetUrl: input.targetUrl || null,
      channels,
    });
    const channelInstructions = channels
      .map((channel) => `- ${channel}: ${marketingChannelGuidance(channel)}`)
      .join("\n");
    const copyTemplate = channels.map((channel) => ({
      platform: channel,
      headline: "...",
      body: "...",
      callToAction: "...",
      targetUrl: input.targetUrl || "",
    }));
    const prompt = `Sen deneyimli bir gayrimenkul pazarlama direktörüsün.
Firma: ${principal.account.companyName}
Kampanya türü: ${input.type}
Amaç: ${input.objective}
Hedef kitle: ${input.audience}
Ton: ${input.tone}
Seçilen kanallar ve kuralları:
${channelInstructions}
Portföy: ${JSON.stringify(
      property
        ? {
            title: property.title,
            referenceCode: property.referenceCode,
            location: property.location,
            price: property.price,
            roomCount: property.roomCount,
            area: property.area,
            description: property.description,
          }
        : null,
    )}

Doğrulanmamış özellik, indirim, getiri, teslim tarihi veya hukuki vaat uydurma. Yalnızca seçilen kanallar için tam birer içerik üret.
Google Ads içeriğinde headline alanını {"headline1":"...","headline2":"...","headline3":"..."}, body alanını {"description1":"...","description2":"..."} biçiminde JSON string olarak ver.
Instagram içeriğinde body alanını {"caption":"...","hashtags":["#..."]} biçiminde JSON string olarak ver.
Yalnızca şu JSON'u döndür:
{"name":"...","description":"...","posterHeadline":"...","posterSubline":"...","posterCta":"...","adCopies":${JSON.stringify(copyTemplate)}}`;
    const aiResult = await callCompanyMarketingAI(principal.account.id, [
      { role: "system", content: "Yanıtın yalnızca geçerli JSON olsun." },
      { role: "user", content: prompt },
    ]);
    const generated = parseGeneratedCampaign(aiResult.content, fallback);

    const campaign = await prisma.adCampaign.create({
      data: {
        companyAccountId: principal.account.id,
        propertyId: property?.id,
        name: generated.name,
        description: generated.description,
        type: input.type,
        objective: input.objective,
        audience: input.audience,
        tone: input.tone,
        posterTemplate: input.posterTemplate,
        posterHeadline: generated.posterHeadline,
        posterSubline: generated.posterSubline,
        posterCta: generated.posterCta,
        generatedBy: aiResult.provider,
        generatedModel: aiResult.model,
        adCopies: {
          create: generated.adCopies.map((copy) => ({
            platform: copy.platform,
            headline: copy.headline,
            body: copy.body,
            callToAction: copy.callToAction,
            targetUrl: copy.targetUrl,
          })),
        },
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
      title: "Kampanya seti hazır",
      message: `${campaign.name} için ${channels.length} kanal metni ve poster şablonu hazırlandı.`,
      link: "/fabrika/pazarlamaci",
      important: false,
      dedupeKey: `ad-campaign-ready:${campaign.id}`,
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[Marketing Generate Error]:", error);
    return NextResponse.json(
      { error: "Kampanya üretilemedi." },
      { status: 500 },
    );
  }
}
