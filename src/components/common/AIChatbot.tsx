"use client";
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
              <div key={i} className={`max-w-[85%] p-2 rounded-md text-sm ${msg.role === 'ai' ? 'bg-white border border-gray-200 self-start' : 'bg-primary-100 text-primary-900 self-end'}`}>
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
