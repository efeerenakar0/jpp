import { NextResponse } from 'next/server';

let memoryProfile: any = {
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
  return NextResponse.json(memoryProfile, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body) {
      if (body.companyName) memoryProfile.companyName = body.companyName;
      if (Array.isArray(body.strengths) && body.strengths.length > 0) memoryProfile.strengths = body.strengths;
      if (Array.isArray(body.uniquePoints) && body.uniquePoints.length > 0) memoryProfile.uniquePoints = body.uniquePoints;
      if (Array.isArray(body.serviceAreas) && body.serviceAreas.length > 0) memoryProfile.serviceAreas = body.serviceAreas;
      if (body.yearsInBusiness) memoryProfile.yearsInBusiness = body.yearsInBusiness;
      if (body.teamSize) memoryProfile.teamSize = body.teamSize;
      if (body.extraNotes) memoryProfile.extraNotes = body.extraNotes;
      memoryProfile.updatedAt = new Date().toISOString();
    }
  } catch (e) {}

  return NextResponse.json({ success: true, profile: memoryProfile }, { status: 200 });
}
