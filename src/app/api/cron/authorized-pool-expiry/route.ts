import { NextResponse } from 'next/server';

import { expireAuthorizedPortfolioShares } from '@/lib/authorized-portfolio-pool-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Yetkisiz cron isteği.' }, { status: 401 });
  }

  const result = await expireAuthorizedPortfolioShares(new Date());
  return NextResponse.json({ success: true, expired: result.count });
}
