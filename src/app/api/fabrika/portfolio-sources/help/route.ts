import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callAI } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { PORTFOLIO_SOURCE_TYPES } from '@/lib/portfolio-connectors';

const helpSchema = z.object({
  sourceType: z.enum(PORTFOLIO_SOURCE_TYPES),
  question: z.string().trim().min(2).max(1000),
});

const guides: Record<(typeof PORTFOLIO_SOURCE_TYPES)[number], string> = {
  JASMINE_API:
    'Business CEO AI tarafından hazırlanan sitenizde /api/jasmine/portfolios adresini kullanın. Bağlantı anahtarı platform tarafından güvenli biçimde yönetilir; bu ekranda anahtar veya parola girmeniz gerekmez. Site adresini kaydedip Kaynağı eşitle düğmesine basın.',
  WORDPRESS:
    'WordPress yönetiminde portföylerin hangi içerik türünde tutulduğunu kontrol edin. Çoğu sitede yalnızca ana site adresi yeterlidir. Özel içerik türü varsa /wp-json/wp/v2/icerik-turu?per_page=50&_embed=1 yolunu Kaynak yolu alanına yazın.',
  SITEMAP:
    'Tarayıcıda siteadresiniz.com/sitemap.xml adresini açın. İlan sayfaları listeleniyorsa site adresini ve gerekirse sitemap yolunu kaydedin. Business CEO AI ilk 16 ilan sayfasındaki JSON-LD ve sayfa meta bilgilerini önizlemeye alır.',
  HTML:
    'Tek bir ilan veya portföy liste sayfası için tam web adresini girin. Sayfada RealEstateListing, Residence veya Product türünde JSON-LD bulunması en iyi sonucu verir; yoksa başlık, açıklama ve görsel meta etiketleri okunur.',
};

export async function POST(request: Request) {
  try {
    await requireFabrikaPrincipal();
    const parsed = helpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Kaynak türü ve sorunuzu yazın.' },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const fallback = guides[input.sourceType];
    try {
      const response = await callAI(
        [
          {
            role: 'system',
            content:
              'Sen Business CEO AI portföy bağlantı uzmanısın. Yalnızca verilen doğrulanmış kurulum bilgisini kullan. Kullanıcıya kısa, numaralı ve teknik olmayan Türkçe adımlar ver. API anahtarı veya parola isteme.',
          },
          {
            role: 'user',
            content: `Kaynak türü: ${input.sourceType}\nDoğrulanmış rehber: ${fallback}\nKullanıcının sorusu: ${input.question}`,
          },
        ],
        'portfolio-source-help'
      );
      return NextResponse.json({
        success: true,
        answer: response.content,
        source: 'AI',
      });
    } catch {
      return NextResponse.json({
        success: true,
        answer: fallback,
        source: 'GUIDE',
      });
    }
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Bağlantı yardımcısı yanıt veremedi.' },
      { status: 500 }
    );
  }
}
