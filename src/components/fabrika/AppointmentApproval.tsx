'use client';

import React from 'react';
import { Calendar, Clock, User, Phone, Check, X, Bell } from 'lucide-react';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  proposedDate: string | null;
  proposedTime: string | null;
  status: string;
  createdAt: string;
  conversation: {
    summary?: string | null;
  };
}

interface AppointmentApprovalProps {
  appointments: Appointment[];
  onApprove: (id: string, note?: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export default function AppointmentApproval({ appointments, onApprove, onReject }: AppointmentApprovalProps) {
  const pendingAppointments = appointments.filter(a => a.status === 'PENDING');

  if (appointments.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
          <Calendar className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">Randevu Talebi Yok</h3>
        <p className="text-slate-500">Şu anda onay bekleyen yeni randevu talebi bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Bell className="w-5 h-5 text-rose-400" />
          Bekleyen Randevu Talepleri
        </h3>
        {pendingAppointments.length > 0 && (
          <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-medium border border-rose-500/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
            {pendingAppointments.length} Yeni Talep
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((appointment) => {
          const isPending = appointment.status === 'PENDING';
          const date = appointment.proposedDate ? new Date(appointment.proposedDate).toLocaleDateString('tr-TR') : 'Tarih Belirtilmemiş';
          
          return (
            <div 
              key={appointment.id} 
              className={`bg-slate-900 rounded-2xl border p-5 relative overflow-hidden transition-all hover:shadow-xl ${
                isPending ? 'border-rose-500/30 shadow-rose-900/10' : 'border-slate-800 opacity-70'
              }`}
            >
              {isPending && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-full -mr-2 -mt-2"></div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">{appointment.customerName}</h4>
                    {appointment.customerPhone && (
                      <div className="flex items-center text-xs text-slate-400 mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {appointment.customerPhone}
                      </div>
                    )}
                  </div>
                </div>
                
                {appointment.status === 'APPROVED' && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold rounded border border-emerald-500/30">
                    Onaylandı
                  </span>
                )}
                {appointment.status === 'REJECTED' && (
                  <span className="px-2 py-1 bg-slate-800 text-slate-400 text-[10px] uppercase font-bold rounded border border-slate-700">
                    Reddedildi
                  </span>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 mb-4 border border-slate-700/50">
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-rose-400" />
                    <span>{date}</span>
                  </div>
                  {appointment.proposedTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-rose-400" />
                      <span>{appointment.proposedTime}</span>
                    </div>
                  )}
                </div>
              </div>

              {appointment.conversation?.summary && (
                <div className="mb-5">
                  <p className="text-xs text-slate-400 line-clamp-2">
                    <span className="font-medium text-slate-500 block mb-1">Sohbet Özeti:</span>
                    {appointment.conversation.summary}
                  </p>
                </div>
              )}

              {isPending && (
                <div className="flex gap-2 mt-auto">
                  <button 
                    onClick={() => onApprove(appointment.id)}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Onayla
                  </button>
                  <button 
                    onClick={() => onReject(appointment.id)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Reddet
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
