'use client';

import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Inbox,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import WhatsAppConnectionPanel from '@/components/fabrika/WhatsAppConnectionPanel';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  buildSalesConversationRows,
  buildSalesSummary,
  customerInitials,
  formatConversationTime,
  type AssistantMetrics,
  type SalesAppointment,
  type SalesConversation,
  type SalesConversationRow,
  type SalesMessage,
  type WhatsAppStatus,
} from './sales-data';
import styles from './BusinessCeoDashboard.module.css';

const statusLabels = {
  NEW: 'Yeni',
  WAITING: 'Yanıt bekliyor',
  APPOINTMENT: 'Randevu',
  ACTIVE: 'Aktif',
} as const;

type SendMessage = (
  conversationId: string,
  message: string
) => Promise<SalesMessage | undefined | void>;

function displayCount(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('tr-TR').format(value);
}

function ConversationDialog({
  conversation,
  onOpenChange,
  onSendMessage,
}: {
  conversation: SalesConversationRow | null;
  onOpenChange: (open: boolean) => void;
  onSendMessage: SendMessage;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedMessage = message.trim();
    if (!conversation || !normalizedMessage || sending) return;

    setSending(true);
    setSendError(null);
    try {
      await onSendMessage(conversation.id, normalizedMessage);
      setMessage('');
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Mesaj gönderilemedi.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={Boolean(conversation)} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent} showCloseButton={false}>
        {conversation ? (
          <>
            <DialogHeader className={styles.dialogHeader}>
              <DialogTitle className={styles.dialogTitle}>
                {conversation.customerName}
              </DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                {conversation.customerPhone || 'Telefon numarası bulunmuyor'} · Gerçek
                sohbet geçmişi
              </DialogDescription>
              <DialogClose className={styles.dialogClose} aria-label="Sohbeti kapat">
                <X aria-hidden="true" />
              </DialogClose>
            </DialogHeader>
            <div className={styles.dialogBody}>
              <div
                aria-label={`${conversation.customerName} sohbet geçmişi`}
                className={styles.chatHistory}
                role="log"
              >
                {conversation.messages.length > 0 ? (
                  conversation.messages.map((item) => {
                    const outbound = ['assistant', 'patron'].includes(item.role);
                    return (
                      <div
                        className={styles.chatMessage}
                        data-outbound={outbound}
                        key={item.id}
                      >
                        {item.content}
                        <time dateTime={item.createdAt}>
                          {formatConversationTime(item.createdAt)}
                        </time>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.chatEmpty}>Henüz mesaj kaydı yok.</div>
                )}
              </div>
              <form className={styles.chatForm} onSubmit={submit}>
                <label className="sr-only" htmlFor="business-ceo-message">
                  Müşteriye gönderilecek mesaj
                </label>
                <input
                  autoComplete="off"
                  className={styles.chatInput}
                  id="business-ceo-message"
                  maxLength={4000}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Müşteriye mesaj yazın…"
                  value={message}
                />
                <button
                  aria-label="Mesajı gönder"
                  className={styles.sendButton}
                  disabled={!message.trim() || sending}
                  type="submit"
                >
                  {sending ? (
                    <RefreshCw aria-hidden="true" className={styles.spinningIcon} />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                </button>
              </form>
              {sendError ? (
                <p className={styles.chatError} role="alert">
                  {sendError}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.whatsappDialogContent} showCloseButton={false}>
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle className={styles.dialogTitle}>WhatsApp Bağlantısı</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            QR oluşturun, bağlantı sağlığını görün veya mevcut telefonu kaldırın.
          </DialogDescription>
          <DialogClose className={styles.dialogClose} aria-label="WhatsApp penceresini kapat">
            <X aria-hidden="true" />
          </DialogClose>
        </DialogHeader>
        <div className={`${styles.dialogBody} ${styles.whatsappDialogBody}`}>
          <WhatsAppConnectionPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SalesExpertPanel({
  appointments,
  conversations,
  error,
  isOwner,
  loading,
  metrics,
  onRefresh,
  onSendMessage,
  whatsappStatus,
  whatsappError = null,
}: {
  appointments: readonly SalesAppointment[];
  conversations: readonly SalesConversation[];
  error: string | null;
  isOwner: boolean;
  loading: boolean;
  metrics: AssistantMetrics | null;
  onRefresh: () => void;
  onSendMessage: SendMessage;
  whatsappStatus: WhatsAppStatus | null;
  whatsappError?: string | null;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const rows = useMemo(
    () => buildSalesConversationRows(conversations, appointments),
    [appointments, conversations]
  );
  const summary = buildSalesSummary(rows, metrics);
  const selectedConversation =
    rows.find((row) => row.id === selectedConversationId) || null;
  const whatsappConnected = whatsappStatus?.connectionStatus === 'CONNECTED';
  const whatsappButtonLabel = whatsappError
    ? 'WhatsApp durumunu kontrol et'
    : whatsappConnected
      ? 'WhatsApp Bağlı'
      : 'WhatsApp Bağla';

  return (
    <section
      aria-busy={loading || undefined}
      aria-labelledby="business-ceo-sales-title"
      className={`${styles.panel} ${styles.salesPanel}`}
    >
      <header className={styles.salesHeader}>
        <div className={styles.salesHeaderCopy}>
          <h2 className={styles.panelTitle} id="business-ceo-sales-title">
            AI Satış Uzmanı
          </h2>
          <p className={styles.panelDescription}>
            Gerçek müşteri konuşmalarınızı ve satış takibinizi yönetin.
          </p>
        </div>
        {isOwner ? (
          <button
            aria-expanded={whatsappOpen}
            aria-haspopup="dialog"
            className={styles.whatsappButton}
            onClick={() => setWhatsappOpen(true)}
            type="button"
          >
            <MessageCircle aria-hidden="true" />
            {whatsappButtonLabel}
          </button>
        ) : null}
      </header>

      {isOwner && whatsappError ? (
        <button className={styles.inlineError} onClick={onRefresh} type="button">
          WhatsApp bağlantı durumu kontrol edilemedi. Yeniden dene
        </button>
      ) : null}

      <dl className={styles.salesMetrics} aria-label="Satış uzmanı özeti">
        <div className={styles.salesMetric}>
          <span className={styles.salesMetricIcon}>
            <MessageCircle aria-hidden="true" />
          </span>
          <div>
            <dt>Yeni mesaj</dt>
            <dd>{displayCount(summary.newMessages)}</dd>
          </div>
        </div>
        <div className={styles.salesMetric}>
          <span className={styles.salesMetricIcon}>
            <Clock3 aria-hidden="true" />
          </span>
          <div>
            <dt>Yanıt bekleyen</dt>
            <dd>{displayCount(summary.waitingForReply)}</dd>
          </div>
        </div>
        <div className={styles.salesMetric}>
          <span className={styles.salesMetricIcon}>
            <CalendarDays aria-hidden="true" />
          </span>
          <div>
            <dt>Randevu</dt>
            <dd>{displayCount(summary.appointments)}</dd>
          </div>
        </div>
      </dl>

      {loading ? (
        <div
          aria-label="Konuşmalar yükleniyor"
          aria-live="polite"
          className={styles.loadingState}
          role="status"
        >
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : error && rows.length === 0 ? (
        <div className={styles.errorState} role="alert">
          <AlertTriangle aria-hidden="true" />
          <strong>Canlı konuşmalar yüklenemedi</strong>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={onRefresh} type="button">
            <RefreshCw aria-hidden="true" />
            Yeniden dene
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.emptyState}>
          <Inbox aria-hidden="true" />
          <strong>Henüz gerçek müşteri konuşması yok</strong>
          <p>WhatsApp veya web sohbetinden mesaj geldiğinde burada görünecek.</p>
        </div>
      ) : (
        <div className={styles.salesList} role="list">
          {error ? (
            <button className={styles.inlineError} onClick={onRefresh} type="button">
              {error} Yeniden dene
            </button>
          ) : null}
          {rows.map((row) => (
            <article className={styles.conversationRow} key={row.id} role="listitem">
              <span className={styles.conversationAvatar} aria-hidden="true">
                {customerInitials(row.customerName)}
              </span>
              <span className={styles.conversationCopy}>
                <strong className={styles.conversationName}>{row.customerName}</strong>
                <span className={styles.conversationPhone}>
                  {row.customerPhone || 'Telefon yok'}
                </span>
                <span className={styles.conversationPreview}>{row.preview}</span>
              </span>
              <time className={styles.conversationTime} dateTime={row.activityAt}>
                {formatConversationTime(row.activityAt)}
              </time>
              <span className={styles.statusBadge} data-status={row.status}>
                {statusLabels[row.status]}
              </span>
              <button
                aria-expanded={selectedConversationId === row.id}
                aria-haspopup="dialog"
                aria-label={`${row.customerName} sohbetini aç`}
                className={styles.messageButton}
                onClick={() => setSelectedConversationId(row.id)}
                type="button"
              >
                <MessageCircle aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}

      <ConversationDialog
        conversation={selectedConversation}
        onOpenChange={(open) => {
          if (!open) setSelectedConversationId(null);
        }}
        onSendMessage={onSendMessage}
      />
      {isOwner ? (
        <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen} />
      ) : null}
    </section>
  );
}
