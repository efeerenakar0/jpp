'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
import type { PortfolioWorkflowLaunchIntent } from '@/lib/portfolio-workflow-intent';

import { BusinessCeoDashboardView } from './BusinessCeoDashboardView';
import type {
  AssistantMetrics,
  SalesAppointment,
  SalesConversation,
  SalesMessage,
  WhatsAppStatus,
} from './sales-data';

type ChatResponse = {
  error?: string;
  messageRecord?: SalesMessage;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(data?.error || fallback);
  }
  return data as T;
}

export default function BusinessCeoDashboard({
  initialWorkflowIntent = null,
}: {
  initialWorkflowIntent?: PortfolioWorkflowLaunchIntent | null;
}) {
  const session = useFabrikaSession();
  const isOwner = session.principalType === 'OWNER';
  const [conversations, setConversations] = useState<SalesConversation[]>([]);
  const [appointments, setAppointments] = useState<SalesAppointment[]>([]);
  const [metrics, setMetrics] = useState<AssistantMetrics | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadDashboard = useCallback(
    async (initial = false) => {
      const sequence = ++requestSequence.current;
      if (initial) setLoading(true);
      try {
        let nextWhatsappError: string | null = null;
        const whatsappRequest = isOwner
          ? fetch('/api/fabrika/whatsapp/connection', { cache: 'no-store' })
              .then((response) =>
                readJson<WhatsAppStatus>(response, 'WhatsApp durumu alınamadı.')
              )
              .catch((cause: unknown) => {
                nextWhatsappError =
                  cause instanceof Error
                    ? cause.message
                    : 'WhatsApp durumu alınamadı.';
                return null;
              })
          : Promise.resolve(null);
        const [conversationResponse, appointmentResponse, metricsResponse, status] =
          await Promise.all([
            fetch('/api/fabrika/assistant/conversations', { cache: 'no-store' }),
            fetch('/api/fabrika/assistant/appointment', { cache: 'no-store' }),
            fetch('/api/fabrika/assistant/metrics', { cache: 'no-store' }),
            whatsappRequest,
          ]);
        const [nextConversations, nextAppointments, nextMetrics] =
          await Promise.all([
            readJson<SalesConversation[]>(
              conversationResponse,
              'Müşteri konuşmaları alınamadı.'
            ),
            readJson<SalesAppointment[]>(
              appointmentResponse,
              'Randevular alınamadı.'
            ),
            readJson<AssistantMetrics>(
              metricsResponse,
              'Satış özeti alınamadı.'
            ),
          ]);

        if (sequence !== requestSequence.current) return;
        setConversations(Array.isArray(nextConversations) ? nextConversations : []);
        setAppointments(Array.isArray(nextAppointments) ? nextAppointments : []);
        setMetrics(nextMetrics);
        setWhatsappStatus(status);
        setWhatsappError(nextWhatsappError);
        setError(null);
      } catch (cause) {
        if (sequence !== requestSequence.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'Canlı veriler alınamadı.'
        );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [isOwner]
  );

  useEffect(() => {
    const initialRequest = window.setTimeout(() => {
      void loadDashboard(false);
    }, 0);
    const interval = window.setInterval(() => {
      void loadDashboard(false);
    }, 20_000);

    return () => {
      requestSequence.current += 1;
      window.clearTimeout(initialRequest);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const sendMessage = useCallback(
    async (conversationId: string, message: string) => {
      const response = await fetch('/api/fabrika/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const data = await readJson<ChatResponse>(
        response,
        'Mesaj gönderilemedi.'
      );

      if (data.messageRecord) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, data.messageRecord!],
                  summary: data.messageRecord!.content,
                  updatedAt: data.messageRecord!.createdAt,
                  _count: {
                    messages:
                      (conversation._count?.messages ??
                        conversation.messages.length) + 1,
                  },
                }
              : conversation
          )
        );
      }
      return data.messageRecord;
    },
    []
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const response = await fetch(
        `/api/fabrika/assistant/conversations?id=${encodeURIComponent(conversationId)}`,
        { method: 'DELETE' }
      );
      await readJson<{ success: boolean }>(response, 'Sohbet silinemedi.');

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId)
      );
      void loadDashboard(false);
    },
    [loadDashboard]
  );

  return (
    <BusinessCeoDashboardView
      appointments={appointments}
      conversations={conversations}
      error={error}
      isOwner={isOwner}
      loading={loading}
      metrics={metrics}
      onDeleteConversation={deleteConversation}
      onRefresh={() => void loadDashboard(true)}
      onSendMessage={sendMessage}
      whatsappStatus={whatsappStatus}
      whatsappError={whatsappError}
      initialWorkflowIntent={initialWorkflowIntent}
    />
  );
}
