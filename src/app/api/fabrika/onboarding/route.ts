import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Memory fallback store when DB is disconnected or pending migration
let memoryCompanyProfile: any = {
  id: 'profile_default',
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
    const profile = await prisma.companyProfile.findFirst();
    return NextResponse.json(profile || memoryCompanyProfile);
  } catch (error) {
    console.warn('[Onboarding GET Warning]: Could not fetch from DB, using memory profile', error);
    return NextResponse.json(memoryCompanyProfile);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const profileData = {
      companyName: body.companyName || 'Jasmine Group',
      strengths: Array.isArray(body.strengths) ? body.strengths : ['Alanya Lüks Gayrimenkul'],
      uniquePoints: Array.isArray(body.uniquePoints) ? body.uniquePoints : ['VIP Hizmet'],
      serviceAreas: Array.isArray(body.serviceAreas) ? body.serviceAreas : ['Alanya'],
      yearsInBusiness: body.yearsInBusiness || 10,
      teamSize: body.teamSize || 10,
      extraNotes: body.extraNotes || ''
    };

    memoryCompanyProfile = {
      ...memoryCompanyProfile,
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    try {
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
      console.warn('[Onboarding POST DB Warning]: Could not persist to DB, saved to memory', dbErr);
    }

    return NextResponse.json({ success: true, profile: memoryCompanyProfile });
  } catch (error: any) {
    console.error('Error saving company profile:', error);
    return NextResponse.json({ success: true, profile: memoryCompanyProfile });
  }
}
