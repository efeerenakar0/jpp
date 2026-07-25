import { NextResponse } from 'next/server';
import { PROMPTS } from '@/lib/ai';

export async function GET() {
  const prompt = PROMPTS.customerAssistant({
    companyName: 'TEST_COMPANY',
    availableListings: 'TEST_LISTINGS',
    conversationHistory: 'TEST_HISTORY',
    customerMessage: 'TEST_MSG',
    assistantName: 'TEST_NAME',
    serviceCity: 'TEST_CITY'
  });
  return NextResponse.json({ prompt });
}
