import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // WhatsApp Cloud API Webhook Mock
  // Receives incoming messages or sends automated greetings
  
  const payload = await req.json();
  console.log("WhatsApp Webhook Received:", payload);
  
  // Implement logic to send a template message
  // fetch('https://graph.facebook.com/v17.0/PHONE_NUMBER_ID/messages', { ... })
  
  return NextResponse.json({ status: 'success' });
}

export async function GET(req: Request) {
  // Verify webhook challenge
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('hub.challenge');
  
  return new NextResponse(challenge, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
