'use client';

import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Inbox,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import Image from 'next/image';
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

function WhatsAppLogo() {
  return (
    <svg
      aria-hidden="true"
      data-brand-icon="whatsapp"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.895a9.825 9.825 0 0 1 2.895 6.988c-.003 5.45-4.437 9.884-9.887 9.884m0-17.791h-.003C5.77 0 .66 5.109.659 11.389c0 2.007.524 3.963 1.52 5.688L.558 24l5.165-1.355a11.37 11.37 0 0 0 5.824 1.485h.005c6.28 0 11.392-5.11 11.393-11.39 0-3.044-1.185-5.906-3.337-8.058A11.323 11.323 0 0 0 12.051 0" />
    </svg>
  );
}

type SendMessage = (
  conversationId: string,
  message: string
) => Promise<SalesMessage | undefined | void>;

type DeleteConversation = (conversationId: string) => Promise<void>;

function displayCount(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('tr-TR').format(value);
}

function ConversationAvatar({
  conversation,
  whatsappConnected,
}: {
  conversation: SalesConversationRow;
  whatsappConnected: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const canLoadRealPhoto =
    whatsappConnected &&
    conversation.channel === 'WHATSAPP' &&
    Boolean(conversation.customerPhone) &&
    !imageFailed;

  return (
    <span className={styles.conversationAvatar}>
      <span aria-hidden="true" className={styles.conversationAvatarInitials}>
        {customerInitials(conversation.customerName)}
      </span>
      {canLoadRealPhoto ? (
        <Image
          alt={`${conversation.customerName} WhatsApp profil fotoğrafı`}
          className={styles.conversationAvatarImage}
          height={43}
          loading="lazy"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
          src={`/api/fabrika/assistant/conversations/${encodeURIComponent(
            conversation.id
          )}/avatar`}
          unoptimized
          width={43}
        />
      ) : null}
    </span>
  );
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

function ConversationDeleteDialog({
  conversation,
  deleting,
  error,
  onConfirm,
  onOpenChange,
}: {
  conversation: SalesConversationRow | null;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={Boolean(conversation)}
      onOpenChange={(open) => {
        if (!deleting) onOpenChange(open);
      }}
    >
      <DialogContent
        className={`${styles.dialogContent} ${styles.deleteDialogContent}`}
        showCloseButton={false}
      >
        {conversation ? (
          <>
            <DialogHeader className={styles.dialogHeader}>
              <DialogTitle className={styles.dialogTitle}>
                Sohbet silinsin mi?
              </DialogTitle>
              <DialogDescription className={styles.dialogDescription}>
                {conversation.customerName} ile yapılan sohbet listeden kaldırılacak.
              </DialogDescription>
              <button
                aria-label="Silme penceresini kapat"
                className={styles.dialogClose}
                disabled={deleting}
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </DialogHeader>
            <div className={styles.deleteDialogBody}>
              <span className={styles.deleteWarningIcon} aria-hidden="true">
                <AlertTriangle />
              </span>
              <div>
                <strong>Bu işlem geri alınamaz. Emin misiniz?</strong>
                <p>
                  Sohbet müşteri listesinden kaldırılır ve yapay zekâ yanıtları
                  durdurulur. Operasyon geçmişi denetim amacıyla korunur.
                </p>
              </div>
            </div>
            {error ? (
              <p className={styles.deleteDialogError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.deleteDialogActions}>
              <button
                className={styles.deleteCancelButton}
                disabled={deleting}
                onClick={() => onOpenChange(false)}
                type="button"
              >
                Vazgeç
              </button>
              <button
                className={styles.deleteConfirmButton}
                disabled={deleting}
                onClick={onConfirm}
                type="button"
              >
                {deleting ? (
                  <RefreshCw aria-hidden="true" className={styles.spinningIcon} />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                {deleting ? 'Siliniyor…' : 'Sohbeti sil'}
              </button>
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
  onDeleteConversation,
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
  onDeleteConversation: DeleteConversation;
  onSendMessage: SendMessage;
  whatsappStatus: WhatsAppStatus | null;
  whatsappError?: string | null;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationToDeleteId, setConversationToDeleteId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const rows = useMemo(
    () => buildSalesConversationRows(conversations, appointments),
    [appointments, conversations]
  );
  const summary = buildSalesSummary(rows, metrics);
  const selectedConversation =
    rows.find((row) => row.id === selectedConversationId) || null;
  const conversationToDelete =
    rows.find((row) => row.id === conversationToDeleteId) || null;
  const whatsappConnected = whatsappStatus?.connectionStatus === 'CONNECTED';
  const whatsappButtonLabel = whatsappError
    ? 'WhatsApp durumunu kontrol et'
    : whatsappConnected
      ? 'WhatsApp Bağlı'
      : 'WhatsApp Bağla';

  async function confirmConversationDelete() {
    if (!conversationToDelete || deletingConversationId) return;

    const conversationId = conversationToDelete.id;
    setDeletingConversationId(conversationId);
    setDeleteError(null);
    try {
      await onDeleteConversation(conversationId);
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
      setConversationToDeleteId(null);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : 'Sohbet silinemedi.'
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

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
            <WhatsAppLogo />
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
              <ConversationAvatar
                conversation={row}
                whatsappConnected={whatsappConnected}
              />
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
              <span className={styles.conversationActions}>
                {isOwner ? (
                  <button
                    aria-haspopup="dialog"
                    aria-label={`${row.customerName} sohbetini sil`}
                    className={styles.deleteButton}
                    onClick={() => {
                      setDeleteError(null);
                      setConversationToDeleteId(row.id);
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                ) : null}
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
              </span>
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
        <ConversationDeleteDialog
          conversation={conversationToDelete}
          deleting={deletingConversationId === conversationToDelete?.id}
          error={deleteError}
          onConfirm={() => void confirmConversationDelete()}
          onOpenChange={(open) => {
            if (!open) {
              setConversationToDeleteId(null);
              setDeleteError(null);
            }
          }}
        />
      ) : null}
      {isOwner ? (
        <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen} />
      ) : null}
    </section>
  );
}
