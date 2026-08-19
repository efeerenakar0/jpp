'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  MessageCircleMore,
  PanelRight,
  Save,
  Send,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserRoundCheck,
  X,
} from 'lucide-react';
import styles from './ChatInterface.module.css';

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
  onOpenCustomerDetails?: () => void;
  customerName: string;
  intent: string;
  notes?: string | null;
  tags?: string[];
  aiEnabled: boolean;
  lastCustomerMessageAt?: string | null;
}

const intentLabels: Record<string, string> = {
  INVESTMENT: 'Yatırımlık',
  RESIDENTIAL: 'Oturmalık',
  BOTH: 'İkisi de',
  UNKNOWN: 'Bilinmiyor',
};

function customerInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
      .join('') || 'M'
  );
}

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
        className={styles.deliveryFailed}
        title={label}
      >
        <AlertCircle aria-hidden="true" />
        Başarısız
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className={styles.delivery} title={label}>
        <CheckCheck aria-hidden="true" />
        Teslim
      </span>
    );
  }
  if (status === 'SENT') {
    return (
      <span className={styles.delivery} title={label}>
        <Check aria-hidden="true" />
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
  onOpenCustomerDetails,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
    } catch {
      // The parent presents the server error; keep the operator's draft ready to retry.
      setInput(currentInput);
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
    <section className={`${styles.shell} ceo-chat-interface`} aria-label={`${customerName} sohbeti`}>
      <header className={`${styles.header} ceo-chat-header`}>
        <div className={styles.headerMain}>
          <div className={styles.customerIdentity}>
            <span className={styles.customerAvatar} aria-hidden="true">
              {customerInitials(customerName)}
              <i><MessageCircleMore /></i>
            </span>
            <div className={styles.customerCopy}>
              <h2>{customerName}</h2>
              <div className={styles.statusLine}>
                <span className={styles.intentBadge} data-intent={intent}>
                  {intentLabels[intent] || intentLabels.UNKNOWN}
                </span>
                <span className={styles.channelStatus} data-open={serviceWindowOpen}>
                  <i />
                  {serviceWindowOpen ? 'WhatsApp · mesajlaşma açık' : 'WhatsApp · şablon gerekli'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            {onOpenCustomerDetails && (
              <button type="button" onClick={onOpenCustomerDetails} className={styles.utilityButton}>
                <PanelRight aria-hidden="true" />
                <span>Müşteri bilgileri</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsProfileOpen((open) => !open)}
              className={styles.utilityButton}
              aria-expanded={isProfileOpen}
              aria-controls={`profile-${conversationId}`}
            >
              <Tag aria-hidden="true" />
              <span>Notlar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void onUpdateConversation({ aiEnabled: !aiEnabled }).catch(() => {});
              }}
              className={styles.modeButton}
              data-ai-enabled={aiEnabled}
              aria-pressed={!aiEnabled}
            >
              {aiEnabled ? <Sparkles aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}
              {aiEnabled ? 'AI Devrede' : 'İnsan Devrede'}
            </button>
            {onDeleteConversation && (
              <button
                type="button"
                onClick={onDeleteConversation}
                title="Sohbeti arşivle"
                aria-label="Sohbeti arşivle"
                className={styles.archiveButton}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {isProfileOpen && (
          <div className={styles.profilePanel} id={`profile-${conversationId}`}>
            <form onSubmit={addTag} className={styles.profileField}>
              <label htmlFor={`tag-${conversationId}`}>
                <Tag aria-hidden="true" /> Müşteri etiketleri
              </label>
              <div className={styles.fieldRow}>
                <input
                  id={`tag-${conversationId}`}
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  placeholder="Örn. Tekrar aranacak"
                />
                <button type="submit">Ekle</button>
              </div>
              {tags.length > 0 && (
                <div className={styles.tagList}>
                  {tags.map((tag) => (
                    <span key={tag}>
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} aria-label={`${tag} etiketini kaldır`}>
                        <X aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </form>

            <div className={styles.profileField}>
              <label htmlFor={`notes-${conversationId}`}>İç müşteri notu</label>
              <div className={styles.fieldRow}>
                <textarea
                  id={`notes-${conversationId}`}
                  rows={2}
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Bütçe, tercih veya takip notu…"
                />
                <button
                  type="button"
                  onClick={saveNotes}
                  disabled={isSavingProfile}
                  aria-label="Müşteri notunu kaydet"
                  className={styles.saveButton}
                >
                  {isSavingProfile ? <Clock aria-hidden="true" /> : <Save aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <div ref={chatContainerRef} className={`${styles.messageArea} custom-scrollbar`} aria-live="polite">
        <div className={styles.dateDivider}><span>Sohbet başlangıcı</span></div>

        {messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <MessageCircleMore aria-hidden="true" />
            <strong>Henüz mesaj yok</strong>
            <p>İlk mesajı aşağıdaki alandan gönderebilirsiniz.</p>
          </div>
        ) : messages.map((message, index) => {
          const isOutbound = message.role === 'assistant' || message.role === 'patron';
          const isHuman = message.role === 'patron';

          return (
            <article
              key={`${message.id || 'message'}-${index}`}
              className={styles.messageRow}
              data-direction={isOutbound ? 'outbound' : 'inbound'}
            >
              <span className={styles.messageAvatar} data-human={isHuman} aria-hidden="true">
                {isOutbound ? (isHuman ? <UserRoundCheck /> : <Bot />) : <User />}
              </span>
              <div className={styles.messageBubble} data-human={isHuman}>
                <p>{message.content}</p>
                <div className={styles.messageMeta}>
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOutbound && <DeliveryIndicator message={message} />}
                  {message.messageType === 'TEMPLATE' && <span>Meta şablonu</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className={styles.composer}>
        <div className={styles.composerInner}>
          <span className={styles.whatsAppMark} aria-hidden="true"><MessageCircleMore /></span>
          <label htmlFor="operator-message" className="sr-only">Müşteriye gönderilecek mesaj</label>
          <input
            id="operator-message"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Mesaj yazın…"
            disabled={isProcessing}
          />
          <button type="submit" disabled={!input.trim() || isProcessing} aria-label="Mesajı gönder">
            {isProcessing ? <Clock aria-hidden="true" /> : <Send aria-hidden="true" />}
          </button>
        </div>
        <p>Enter ile gönder</p>
      </form>
    </section>
  );
}
