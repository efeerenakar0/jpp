'use client';

import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  Clock,
  Edit3,
  Loader2,
  Phone,
  RefreshCw,
  Send,
  User,
  X,
} from 'lucide-react';

type AppointmentAction =
  | 'approve'
  | 'reject'
  | 'resend'
  | 'reschedule'
  | 'cancel'
  | 'remind';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  proposedDate: string | null;
  proposedTime: string | null;
  status: string;
  confirmationSent?: boolean;
  reminderSentAt?: string | null;
  createdAt: string;
  conversation: {
    summary?: string | null;
  };
}

interface AppointmentApprovalProps {
  appointments: Appointment[];
  onAction: (
    id: string,
    action: AppointmentAction,
    data?: { proposedDate?: string; proposedTime?: string }
  ) => Promise<void>;
  processingId: string | null;
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-slate-700/60 text-slate-300 border-slate-600',
  CANCELLED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal Edildi',
};

export default function AppointmentApproval({
  appointments,
  onAction,
  processingId,
}: AppointmentApprovalProps) {
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === 'PENDING'
  );

  const openReschedule = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setNewDate(
      appointment.proposedDate
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
          }).format(new Date(appointment.proposedDate))
        : ''
    );
    setNewTime(appointment.proposedTime || '');
  };

  const submitReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAppointment || !newDate || !newTime) {
      return;
    }
    try {
      await onAction(editingAppointment.id, 'reschedule', {
        proposedDate: newDate,
        proposedTime: newTime,
      });
      setEditingAppointment(null);
    } catch {
      // The parent shows the API error and keeps the form open for correction.
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
          <Calendar className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-200 mb-2">
          Randevu Kaydı Yok
        </h3>
        <p className="text-slate-400 text-sm">
          Yeni WhatsApp randevu talepleri burada görünecek.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="appointment-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3
            id="appointment-heading"
            className="text-lg font-semibold text-slate-100 flex items-center gap-2"
          >
            <Bell className="w-5 h-5 text-rose-400" />
            Randevu Yönetimi
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Onayla, değiştir, hatırlat veya iptal et; müşteriye WhatsApp’tan
            otomatik bilgi verilir.
          </p>
        </div>
        <span className="px-3 py-1.5 bg-rose-500/15 text-rose-300 rounded-full text-xs font-medium border border-rose-500/20">
          {pendingAppointments.length} bekleyen · {appointments.length} toplam
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {appointments.map((appointment) => {
          const isPending = appointment.status === 'PENDING';
          const isApproved = appointment.status === 'APPROVED';
          const isProcessing = processingId === appointment.id;
          const date = appointment.proposedDate
            ? new Date(appointment.proposedDate).toLocaleDateString('tr-TR', {
                timeZone: 'Europe/Istanbul',
              })
            : 'Tarih belirtilmedi';

          return (
            <article
              key={appointment.id}
              className={`bg-slate-900 rounded-2xl border p-5 relative overflow-hidden transition-all ${
                isPending
                  ? 'border-rose-500/30 shadow-lg shadow-rose-950/20'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                    <User className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-slate-100 truncate">
                      {appointment.customerName}
                    </h4>
                    {appointment.customerPhone && (
                      <div className="flex items-center text-xs text-slate-400 mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {appointment.customerPhone}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-[10px] uppercase font-bold rounded border shrink-0 ${
                    statusStyles[appointment.status] || statusStyles.REJECTED
                  }`}
                >
                  {statusLabels[appointment.status] || appointment.status}
                </span>
              </div>

              <div className="bg-slate-950/70 rounded-xl p-3 mb-4 border border-slate-800">
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-rose-400" />
                    {date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-400" />
                    {appointment.proposedTime || 'Saat belirtilmedi'}
                  </span>
                </div>
              </div>

              {appointment.conversation?.summary && (
                <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                  {appointment.conversation.summary}
                </p>
              )}

              {isPending && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void onAction(appointment.id, 'approve').catch(() => {});
                    }}
                    disabled={isProcessing}
                    className="min-h-11 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60 text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Onayla
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onAction(appointment.id, 'reject').catch(() => {});
                    }}
                    disabled={isProcessing}
                    className="min-h-11 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <X className="w-4 h-4" />
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => openReschedule(appointment)}
                    disabled={isProcessing}
                    className="col-span-2 min-h-11 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-60 text-blue-300 border border-blue-500/20 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Tarih veya Saati Belirle
                  </button>
                </div>
              )}

              {isApproved && (
                <div className="grid grid-cols-2 gap-2">
                  {!appointment.confirmationSent && (
                    <button
                      type="button"
                      onClick={() => {
                        void onAction(appointment.id, 'resend').catch(() => {});
                      }}
                      disabled={isProcessing}
                      className="col-span-2 min-h-11 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60 text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      WhatsApp’a Gönder
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openReschedule(appointment)}
                    disabled={isProcessing}
                    className="min-h-11 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-60 text-blue-300 border border-blue-500/20 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onAction(appointment.id, 'remind').catch(() => {});
                    }}
                    disabled={isProcessing}
                    className="min-h-11 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-60 text-purple-300 border border-purple-500/20 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Hatırlat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Randevuyu iptal edip müşteriye WhatsApp mesajı göndermek istiyor musunuz?'
                        )
                      ) {
                        void onAction(appointment.id, 'cancel').catch(() => {});
                      }
                    }}
                    disabled={isProcessing}
                    className="col-span-2 min-h-11 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-60 text-amber-300 border border-amber-500/20 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Randevuyu İptal Et
                  </button>
                </div>
              )}

              {appointment.reminderSentAt && isApproved && (
                <p className="text-[11px] text-purple-300 mt-3 text-center">
                  Son hatırlatma:{' '}
                  {new Date(appointment.reminderSentAt).toLocaleString('tr-TR')}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {editingAppointment && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-title"
        >
          <form
            onSubmit={submitReschedule}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h4
                  id="reschedule-title"
                  className="text-lg font-bold text-white"
                >
                  Randevuyu Değiştir
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Yeni tarih müşteriye WhatsApp üzerinden bildirilecek.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAppointment(null)}
                aria-label="Pencereyi kapat"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="appointment-new-date"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Yeni tarih
                </label>
                <input
                  id="appointment-new-date"
                  type="date"
                  required
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="appointment-new-time"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Yeni saat
                </label>
                <input
                  id="appointment-new-time"
                  type="time"
                  required
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-rose-400 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                processingId === editingAppointment.id || !newDate || !newTime
              }
              className="w-full min-h-11 mt-5 bg-gradient-to-r from-rose-500 to-pink-600 disabled:opacity-60 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            >
              {processingId === editingAppointment.id && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Değişikliği Kaydet ve Bildir
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
