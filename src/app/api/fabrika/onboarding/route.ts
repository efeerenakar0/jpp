import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const profile = await prisma.companyProfile.findFirst();
    return NextResponse.json(profile || null);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = await prisma.companyProfile.findFirst();

    let profile;
    if (existing) {
      profile = await prisma.companyProfile.update({
        where: { id: existing.id },
        data: body,
      });
    } else {
      profile = await prisma.companyProfile.create({
        data: body,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error saving company profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
