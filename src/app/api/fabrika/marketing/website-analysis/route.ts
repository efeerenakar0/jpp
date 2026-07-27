import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { callCompanyMarketingAI } from '@/lib/marketing-ai';
import { safeFetchText } from '@/lib/portfolio-connectors';

const schema = z.object({
  websiteUrl: z.string().trim().url('Geçerli bir web sitesi adresi girin.').max(1000),
});

type Analysis = {
  summary: string;
  strengths: string[];
  opportunities: string[];
  channelPlan: string[];
  firstActions: string[];
};

function plainWebsiteText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14_000);
}

function fallbackAnalysis(domain: string, siteText: string): Analysis {
  const hasPortfolio = /portföy|ilan|satılık|kiralık/i.test(siteText);
  const hasContact = /iletişim|whatsapp|telefon|randevu/i.test(siteText);
  return {
    summary: `${domain} için dönüşüm, yerel görünürlük ve portföy talebi odaklı uygulanabilir bir büyüme planı hazırlandı.`,
    strengths: [
      hasPortfolio ? 'Portföy niyetini karşılayan içerik sinyalleri mevcut.' : 'Marka alan adı doğrudan kampanya hedefi olarak kullanılabilir.',
      hasContact ? 'Ziyaretçiyi iletişime yönlendiren temas noktaları algılandı.' : 'Temiz bir iletişim dönüşüm hattı kurulabilir.',
    ],
    opportunities: [
      'Her aktif portföy için konum ve özellik odaklı ayrı açılış sayfası oluşturun.',
      'Telefon, WhatsApp ve randevu tıklamalarını ölçülebilir dönüşüm olarak tanımlayın.',
      'Google İşletme Profili ve yerel arama sayfalarını aynı mesaj diliyle güçlendirin.',
    ],
    channelPlan: [
      'Google Search · Yüksek niyetli “konum + satılık/kiralık” aramaları',
      'Instagram · Portföy fotoğrafı, kısa video ve yeniden hedefleme',
      'WhatsApp · Yalnızca izinli taleplere hızlı portföy takibi',
    ],
    firstActions: [
      'GA4 ve reklam dönüşüm etiketlerini doğrulayın.',
      'En güçlü üç portföy için ayrı kampanya ve poster üretin.',
      'İlk 14 gün arama terimlerini günlük inceleyip negatif kelimeleri ekleyin.',
    ],
  };
}

function parseAnalysis(content: string, fallback: Analysis): Analysis {
  if (!content.trim()) return fallback;
  try {
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] || content) as Record<string, unknown>;
    const list = (value: unknown, defaultValue: string[]) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 6)
        : defaultValue;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 1200) : fallback.summary,
      strengths: list(parsed.strengths, fallback.strengths),
      opportunities: list(parsed.opportunities, fallback.opportunities),
      channelPlan: list(parsed.channelPlan, fallback.channelPlan),
      firstActions: list(parsed.firstActions, fallback.firstActions),
    };
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const fetched = await safeFetchText(parsed.data.websiteUrl);
    const websiteUrl = new URL(fetched.url);
    const siteText = plainWebsiteText(fetched.text);
    const fallback = fallbackAnalysis(websiteUrl.hostname, siteText);
    const ai = await callCompanyMarketingAI(principal.account.id, [
      {
        role: 'system',
        content: 'Sen ölçülebilir büyüme planı hazırlayan bir gayrimenkul performans pazarlama uzmanısın. Yalnızca JSON ver.',
      },
      {
        role: 'user',
        content: `Şu gayrimenkul web sitesini yalnızca verilen görünür içerik üzerinden analiz et.
URL: ${websiteUrl.toString()}
İçerik: ${siteText || 'Sayfada okunabilir metin bulunamadı.'}
Uydurma trafik, dönüşüm veya teknik ölçüm verisi verme.
JSON: {"summary":"...","strengths":["..."],"opportunities":["..."],"channelPlan":["..."],"firstActions":["..."]}`,
      },
    ]);
    const analysis = parseAnalysis(ai.content, fallback);
    const created = await prisma.marketingWebsiteAnalysis.create({
      data: {
        companyAccountId: principal.account.id,
        websiteUrl: websiteUrl.toString(),
        domain: websiteUrl.hostname,
        summary: analysis.summary,
        strengths: JSON.stringify(analysis.strengths),
        opportunities: JSON.stringify(analysis.opportunities),
        channelPlan: JSON.stringify(analysis.channelPlan),
        firstActions: JSON.stringify(analysis.firstActions),
        generatedBy: ai.provider,
        generatedModel: ai.model,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Web sitesi analiz edilemedi.' },
      { status: 400 }
    );
  }
}
