import { NextResponse } from 'next/server';

let memoryProfile: any = {
  id: 'default_profile_id',
  companyName: 'Jasmine Group',
  strengths: ['Gelişmiş Alanya Portföy Ağı', 'Yabancı İkamet ve Vatandaşlık Uzmanlığı', 'Ücretsiz Drone ve VIP Servis'],
  uniquePoints: ['Sadece Bize Özel Yatırımcı Ağı', 'Hızlı ve Güvenilir Satış'],
  serviceAreas: ['Alanya', 'Mahmutlar', 'Kargıcak', 'Oba', 'Kleopatra'],
  yearsInBusiness: 10,
  teamSize: 15,
  extraNotes: 'Alanya bölgesinde lüks konut ve villa uzmanı'
};

export async function GET() {
  try {
    const prismaModule = await import('@/lib/prisma');
    const prisma = prismaModule.default;
    const profile = await prisma.companyProfile.findFirst();
    if (profile) return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.warn('[Onboarding GET Warning]: Using memory fallback profile');
  }

  return NextResponse.json(memoryProfile, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const profileData = {
      companyName: body.companyName || 'Jasmine Group',
      strengths: Array.isArray(body.strengths) && body.strengths.length > 0 ? body.strengths : ['Alanya Lüks Gayrimenkul'],
      uniquePoints: Array.isArray(body.uniquePoints) && body.uniquePoints.length > 0 ? body.uniquePoints : ['VIP Hizmet'],
      serviceAreas: Array.isArray(body.serviceAreas) && body.serviceAreas.length > 0 ? body.serviceAreas : ['Alanya'],
      yearsInBusiness: body.yearsInBusiness || 10,
      teamSize: body.teamSize || 10,
      extraNotes: body.extraNotes || 'Alanya bölgesinde lüks konut uzmanı'
    };

    memoryProfile = {
      ...memoryProfile,
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    try {
      const prismaModule = await import('@/lib/prisma');
      const prisma = prismaModule.default;
      const existing = await prisma.companyProfile.findFirst();
      if (existing) {
        await prisma.companyProfile.update({
          where: { id: existing.id },
          data: profileData,
        });
      } else {
        await prisma.companyProfile.create({
          data: profileData,
        });
      }
    } catch (dbErr) {
      console.warn('[Onboarding POST DB Warning]: Saved to memory profile', dbErr);
    }

    return NextResponse.json({ success: true, profile: memoryProfile }, { status: 200 });
  } catch (error: any) {
    console.error('[Onboarding POST Global Error]:', error);
    return NextResponse.json({ success: true, profile: memoryProfile }, { status: 200 });
  }
}
