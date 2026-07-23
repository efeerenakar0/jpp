'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Clock, Calendar, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  onDeleteConversation?: () => void;
  customerName: string;
  intent: string;
}

const intentColors: Record<string, string> = {
  INVESTMENT: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  RESIDENTIAL: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BOTH: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  UNKNOWN: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const intentLabels: Record<string, string> = {
  INVESTMENT: 'Yatırımlık',
  RESIDENTIAL: 'Oturmalık',
  BOTH: 'İkisi de',
  UNKNOWN: 'Bilinmiyor',
};

export default function ChatInterface({ conversationId, messages, onSendMessage, onDeleteConversation, customerName, intent }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottomInternal = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottomInternal();
  }, [messages, isProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const currentInput = input;
    setInput('');
    setIsProcessing(true);
    
    try {
      await onSendMessage(currentInput);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
            <User className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-medium text-slate-200">{customerName}</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Canlı Sohbet</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className={`px-2 py-0.5 rounded-full border ${intentColors[intent] || intentColors.UNKNOWN}`}>
                {intentLabels[intent] || intentLabels.UNKNOWN}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm text-slate-400 font-medium hidden sm:inline-block">Yapay Zeka Devrede</span>
          </div>

          {onDeleteConversation && (
            <button
              onClick={onDeleteConversation}
              title="Sohbeti Sil"
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/80 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scrollable Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-slate-900 to-slate-900/90 relative z-0"
      >
        <div className="text-center py-4">
          <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">Sohbet Başlangıcı</span>
        </div>
        
        {messages.map((msg, index) => {
          const isAI = msg.role === 'assistant';
          const uniqueKey = `${msg.id || 'msg'}-${index}`;
          return (
            <div key={uniqueKey} className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border ${
                  isAI 
                    ? 'bg-gradient-to-br from-rose-500 to-pink-600 border-pink-500/30' 
                    : 'bg-slate-800 border-slate-700'
                }`}>
                  {isAI ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-slate-300" />}
                </div>
                
                <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                  isAI 
                    ? 'bg-slate-800/80 border border-slate-700 text-slate-200 rounded-tl-sm' 
                    : 'bg-gradient-to-br from-rose-600 to-pink-700 text-white rounded-tr-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className={`text-[10px] mt-2 flex items-center ${isAI ? 'text-slate-500' : 'text-rose-200'}`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {isProcessing && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[75%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 border border-pink-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl rounded-tl-sm text-slate-400 flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-2 font-medium">Asistan yanıt yazıyor...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-900/80 border-t border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mesajınızı yazın..."
            disabled={isProcessing}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
