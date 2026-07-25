import { NextResponse } from 'next/server';
import { callAI, PROMPTS } from '@/lib/ai';

/**
 * Simulate an incoming Meta WhatsApp Message for instant UI testing
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message || 'Merhaba, Alanya projeleri hakkında bilgi alabilir miyim?';

    // 1. Trigger Groq AI Auto-Response
    const systemPrompt = PROMPTS.customerAssistant({
      companyName: 'Jasmine Group',
      availableListings: 'Mahmutlar 1+1, Oba 2+1, Kestel 1+1',
      conversationHistory: `Müşteri: ${message}`,
      customerMessage: message
    });

    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);

    const replyText = aiResponse.content;

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: replyText,
      conversationId: `conv_sim_${Date.now()}`
    });

  } catch (error: any) {
    console.error('[Simulate Incoming Error]:', error);
    return NextResponse.json({
      error: error?.message || 'Simulation error'
    }, { status: 500 });
  }
}
