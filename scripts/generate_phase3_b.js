import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/app/api/webhook/whatsapp/route.ts': `import { NextResponse } from 'next/server';

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
`,
  'src/app/api/crm/sync/route.ts': `import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // CRM Sync Adapter - Mock HubSpot Integration
  const leadData = await req.json();
  
  console.log("Syncing to HubSpot CRM:", leadData);
  
  // Mock API Call
  // fetch('https://api.hubapi.com/crm/v3/objects/contacts', { ... })
  
  return NextResponse.json({ success: true, crmId: "hubspot_12345" });
}
`,
  'src/app/api/chat/route.ts': `import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // AI Chatbot endpoint mock
  const { message } = await req.json();
  
  console.log("Chatbot message received:", message);
  
  // Mock Anthropic/OpenAI call
  const reply = "Merhaba! Jasmine Proje Pazarlama AI asistanıyım. Size projelerimiz, fiyatlar ve Alanya bölgesindeki yatırımlar hakkında nasıl yardımcı olabilirim? (Mock Yanıt)";
  
  return NextResponse.json({ reply });
}
`,
  'src/components/common/AIChatbot.tsx': `"use client";
import { useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([
    { role: 'ai', content: 'Merhaba! Ben Jasmine AI Asistanı. Size nasıl yardımcı olabilirim?' }
  ]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");

    // Call mock API
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Üzgünüm, şu an bağlantı kuramıyorum. Lütfen iletişim formunu kullanın.' }]);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-xl w-80 h-96 flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-primary-900 text-white p-3 flex justify-between items-center">
            <span className="font-medium">Jasmine AI Asistan</span>
            <button onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={\`max-w-[85%] p-2 rounded-md text-sm \${msg.role === 'ai' ? 'bg-white border border-gray-200 self-start' : 'bg-primary-100 text-primary-900 self-end'}\`}>
                {msg.content}
              </div>
            ))}
          </div>
          <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="Mesajınız..." 
              className="flex-1 p-2 text-sm border rounded-md"
            />
            <button onClick={sendMessage} className="bg-primary-700 text-white p-2 rounded-md">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-primary-900 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform">
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
