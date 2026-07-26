'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Save,
  Send,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserRoundCheck,
  X,
} from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  deliveryStatus?: string;
  messageType?: string;
  deliveredAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
}

interface ChatInterfaceProps {
  conversationId: string;
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  onUpdateConversation: (updates: {
    notes?: string;
    tags?: string[];
    aiEnabled?: boolean;
  }) => Promise<void>;
  onDeleteConversation?: () => void;
  customerName: string;
  intent: string;
  notes?: string | null;
  tags?: string[];
  aiEnabled: boolean;
  lastCustomerMessageAt?: string | null;
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

function DeliveryIndicator({ message }: { message: Message }) {
  const status = message.deliveryStatus || 'NOT_APPLICABLE';
  const isDelivered = status === 'DELIVERED' || status === 'READ';
  const label =
    isDelivered
      ? 'Teslim edildi'
        : status === 'SENT'
          ? 'Gönderildi'
          : status === 'FAILED'
            ? message.errorMessage || 'Gönderilemedi'
            : 'Yerel kayıt';

  if (status === 'FAILED') {
    return (
      <span
        className="inline-flex items-center gap-1 text-red-300"
        title={label}
      >
        <AlertCircle className="w-3 h-3" />
        Başarısız
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center gap-1" title={label}>
        <CheckCheck className="w-3.5 h-3.5" />
        Teslim
      </span>
    );
  }
  if (status === 'SENT') {
    return (
      <span className="inline-flex items-center gap-1" title={label}>
        <Check className="w-3 h-3" />
        Gönderildi
      </span>
    );
  }

  return null;
}

export default function ChatInterface({
  conversationId,
  messages,
  onSendMessage,
  onUpdateConversation,
  onDeleteConversation,
  customerName,
  intent,
  notes,
  tags = [],
  aiEnabled,
  lastCustomerMessageAt,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(notes || '');
  const [tagDraft, setTagDraft] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [serviceWindowOpen, setServiceWindowOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWindow = () => {
      if (!lastCustomerMessageAt) {
        setServiceWindowOpen(false);
        return;
      }
      const elapsed = Date.now() - new Date(lastCustomerMessageAt).getTime();
      setServiceWindowOpen(elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000);
    };
    updateWindow();
    const interval = window.setInterval(updateWindow, 60_000);
    return () => window.clearInterval(interval);
  }, [lastCustomerMessageAt]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isProcessing) {
      return;
    }

    const currentInput = input.trim();
    setInput('');
    setIsProcessing(true);
    try {
      await onSendMessage(currentInput);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveNotes = async () => {
    setIsSavingProfile(true);
    try {
      await onUpdateConversation({ notes: notesDraft });
    } catch {
      // The parent displays the request error.
    } finally {
      setIsSavingProfile(false);
    }
  };

  const addTag = async (event: React.FormEvent) => {
    event.preventDefault();
    const tag = tagDraft.trim();
    if (!tag || tags.includes(tag)) {
      return;
    }
    setTagDraft('');
    try {
      await onUpdateConversation({ tags: [...tags, tag] });
    } catch {
      // The parent displays the request error.
    }
  };

  const removeTag = async (tag: string) => {
    try {
      await onUpdateConversation({
        tags: tags.filter((existingTag) => existingTag !== tag),
      });
    } catch {
      // The parent displays the request error.
    }
  };

  return (
    <section className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <header className="px-4 sm:px-6 py-3.5 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-100 truncate">
                {customerName}
              </h3>
              <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    intentColors[intent] || intentColors.UNKNOWN
                  }`}
                >
                  {intentLabels[intent] || intentLabels.UNKNOWN}
                </span>
                <span
                  className={
                    serviceWindowOpen ? 'text-emerald-300' : 'text-amber-300'
                  }
                >
                  {serviceWindowOpen
                    ? '24 saatlik mesajlaşma açık'
                    : 'Mesaj için Meta şablonu gerekir'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void onUpdateConversation({
                  aiEnabled: !aiEnabled,
                }).catch(() => {});
              }}
              className={`min-h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-rose-400 ${
                aiEnabled
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
              aria-pressed={!aiEnabled}
            >
              {aiEnabled ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <UserRoundCheck className="w-4 h-4" />
              )}
              {aiEnabled ? 'AI Devrede' : 'İnsan Devrede'}
            </button>
            {onDeleteConversation && (
              <button
                type="button"
                onClick={onDeleteConversation}
                title="Sohbeti arşivle"
                aria-label="Sohbeti arşivle"
                className="min-w-10 min-h-10 flex items-center justify-center text-slate-400 hover:text-red-300 bg-slate-800 hover:bg-red-500/10 border border-slate-700 rounded-xl focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-3 mt-3 pt-3 border-t border-slate-800/80">
          <form onSubmit={addTag} className="space-y-2">
            <label
              htmlFor={`tag-${conversationId}`}
              className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"
            >
              <Tag className="w-3 h-3" />
              Müşteri etiketleri
            </label>
            <div className="flex gap-2">
              <input
                id={`tag-${conversationId}`}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="Örn. Sıcak müşteri"
                className="min-w-0 flex-1 h-9 bg-slate-950 border border-slate-700 rounded-lg px-3 text-xs text-white focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
              />
              <button
                type="submit"
                className="h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200"
              >
                Ekle
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`${tag} etiketini kaldır`}
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>
          <div>
            <label
              htmlFor={`notes-${conversationId}`}
              className="text-[11px] font-semibold text-slate-400"
            >
              İç müşteri notu
            </label>
            <div className="flex gap-2 mt-2">
              <textarea
                id={`notes-${conversationId}`}
                rows={2}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Bütçe, tercih veya takip notu…"
                className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white resize-none focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
              />
              <button
                type="button"
                onClick={saveNotes}
                disabled={isSavingProfile}
                aria-label="Müşteri notunu kaydet"
                className="w-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center disabled:opacity-60"
              >
                {isSavingProfile ? (
                  <Clock className="w-4 h-4 animate-pulse" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-slate-900 to-slate-950/80"
        aria-live="polite"
      >
        <div className="text-center py-2">
          <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
            Sohbet Başlangıcı
          </span>
        </div>

        {messages.map((message, index) => {
          const isOutbound =
            message.role === 'assistant' || message.role === 'patron';
          const isHuman = message.role === 'patron';

          return (
            <div
              key={`${message.id || 'message'}-${index}`}
              className={`flex ${
                isOutbound ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex gap-2.5 max-w-[88%] sm:max-w-[78%] ${
                  isOutbound ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mt-1 border shrink-0 ${
                    isOutbound
                      ? isHuman
                        ? 'bg-blue-600 border-blue-400/30'
                        : 'bg-gradient-to-br from-rose-500 to-pink-600 border-pink-500/30'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  {isOutbound ? (
                    isHuman ? (
                      <UserRoundCheck className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )
                  ) : (
                    <User className="w-4 h-4 text-slate-200" />
                  )}
                </div>
                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    isOutbound
                      ? isHuman
                        ? 'bg-blue-600/90 text-white rounded-tr-sm'
                        : 'bg-rose-600/90 text-white rounded-tr-sm'
                      : 'bg-slate-800/90 border border-slate-700 text-slate-100 rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  <div className="text-[10px] mt-2 flex flex-wrap items-center gap-2 opacity-80">
                    <span className="inline-flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(message.createdAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isOutbound && <DeliveryIndicator message={message} />}
                    {message.messageType === 'TEMPLATE' && (
                      <span>Meta şablonu</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 bg-slate-900/90 border-t border-slate-800 shrink-0"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="operator-message" className="sr-only">
            Müşteriye gönderilecek mesaj
          </label>
          <input
            id="operator-message"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Müşteriye manuel mesaj yazın…"
            disabled={isProcessing}
            className="flex-1 min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            aria-label="Mesajı gönder"
            className="min-w-11 min-h-11 bg-gradient-to-r from-rose-500 to-pink-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-white"
          >
            {isProcessing ? (
              <Clock className="w-5 h-5 animate-pulse" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
