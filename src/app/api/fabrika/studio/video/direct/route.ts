import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { createCreativeScenePlan } from '@/lib/portfolio-video/ai-scene-director';
import { LocalRuleCreativeDirector } from '@/lib/portfolio-video/creative-director';
import { loadPortfolioVideoCatalog } from '@/lib/portfolio-video/data';
import { buildPortfolioStoryboard } from '@/lib/portfolio-video/storyboard';
import { portfolioVideoStyleSchema } from '@/lib/portfolio-video/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const requestSchema = z.object({
  portfolioId: z.string().trim().min(1).max(120),
  command: z.string().trim().min(3, 'Yaratıcı talimatınızı biraz daha ayrıntılı yazın.').max(1_000),
  preferredStyle: portfolioVideoStyleSchema.optional(),
  selectedPhotoIds: z.array(z.string().min(1).max(120)).min(1).max(8),
  showPrice: z.boolean(),
  showLocation: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Video talimatı geçersiz.' },
        { status: 400 }
      );
    }
    const catalog = await loadPortfolioVideoCatalog(principal);
    const portfolio = catalog.portfolios.find((item) => item.id === parsed.data.portfolioId);
    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portföy bulunamadı veya bu şirkete ait değil.' },
        { status: 404 }
      );
    }
    const photoIds = new Set(portfolio.photos.map((photo) => photo.id));
    if (parsed.data.selectedPhotoIds.some((id) => !photoIds.has(id))) {
      return NextResponse.json(
        { success: false, error: 'Seçilen fotoğraflardan biri bu portföye ait değil.' },
        { status: 400 }
      );
    }
    const direction = new LocalRuleCreativeDirector().direct({
      command: parsed.data.command,
      preferredStyle: parsed.data.preferredStyle,
    });
    const selectedPortfolio = {
      ...portfolio,
      photos: parsed.data.selectedPhotoIds
        .map((id) => portfolio.photos.find((photo) => photo.id === id))
        .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)),
    };
    const result = await createCreativeScenePlan({
      companyAccountId: principal.account.id,
      command: parsed.data.command,
      portfolio: selectedPortfolio,
      photoCount: selectedPortfolio.photos.length,
      showPrice: parsed.data.showPrice && direction.showPrice,
      showLocation: parsed.data.showLocation,
    });
    const storyboard = buildPortfolioStoryboard({
      portfolio,
      direction,
      selectedPhotoIds: parsed.data.selectedPhotoIds,
      showPrice: parsed.data.showPrice && direction.showPrice,
      showLocation: parsed.data.showLocation,
      scenePlan: result.plan,
    });
    return NextResponse.json({
      success: true,
      storyboard,
      director: {
        source: result.source,
        model: result.model,
        usedFallback: result.usedFallback,
      },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('[portfolio-video] direction_failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { success: false, error: 'Yaratıcı talimat videoya uygulanamadı.' },
      { status: 500 }
    );
  }
}
