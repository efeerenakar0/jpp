import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // AI Chatbot endpoint mock
  const { message } = await req.json();
  
  console.log("Chatbot message received:", message);
  
  // Mock Anthropic/OpenAI call
  const reply = "Merhaba! Business CEO AI asistanıyım. Size portföyler, fiyatlar ve gayrimenkul operasyonlarınız hakkında nasıl yardımcı olabilirim? (Mock Yanıt)";
  
  return NextResponse.json({ reply });
}
