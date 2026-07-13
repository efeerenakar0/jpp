import { NextResponse } from 'next/server';
// import { Ratelimit } from "@upstash/ratelimit";
// import { Redis } from "@upstash/redis";

// Mock Rate Limiting
const rateLimitMap = new Map();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const now = Date.now();
    const limit = 5;
    const windowMs = 60000;
    
    const userLimits = rateLimitMap.get(ip) || { count: 0, timestamp: now };
    
    if (now - userLimits.timestamp > windowMs) {
      userLimits.count = 1;
      userLimits.timestamp = now;
    } else {
      userLimits.count++;
      if (userLimits.count > limit) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
    rateLimitMap.set(ip, userLimits);

    const body = await req.json();
    
    // In a real app, validate with zod
    // Save to DB via Prisma
    
    return NextResponse.json({ success: true, message: "Talebiniz başarıyla alındı." });
  } catch (error) {
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}
