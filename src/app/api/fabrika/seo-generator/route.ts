import { NextResponse } from 'next/server';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, location, price, roomCount, area } = body;

    const prompt = PROMPTS.seoGenerator({ title, location, price, roomCount, area });
    const aiResponse = await callAI([{ role: 'user', content: prompt }], 'seo');
    
    const parsed = parseJSONResponse(aiResponse.content);
    
    return NextResponse.json(parsed || { error: 'Failed to generate SEO content' });
  } catch (error) {
    console.error('SEO Generation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
