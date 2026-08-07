'use client';

import {
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Code2,
  Crosshair,
  FileText,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Palette,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Video,
} from 'lucide-react';
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type ExecutivePortfolioDraft,
  type ExecutiveWorkflowSource,
  type ExecutiveWorkflowStep,
} from '../../../lib/executive-portfolio-workflow';
import { PortfolioWorkflowDialog } from './PortfolioWorkflowContent';
import {
  getPortfolioWorkflowStatus,
  usePortfolioWorkflowController,
} from './usePortfolioWorkflowController';

const DESIGN_STORAGE_KEY = 'business-ceo:dashboard-design';

type AssistantMessage = {
  id: string;
  role: 'patron' | 'asistan' | 'system';
  content: string;
  createdAt: string;
};

type AssistantContext = {
  company?: { principalName?: string; name?: string };
  metrics?: {
    overdueTasks?: number;
    activeConversations?: number;
    openDeals?: number;
  };
};

type AssistantSuggestion = { label: string; prompt: string };

type AssistantPayload = {
  messages?: AssistantMessage[];
  context?: AssistantContext;
  suggestions?: AssistantSuggestion[];
};

const fallbackSuggestions: AssistantSuggestion[] = [
  { label: 'Geciken görevler', prompt: 'Geciken görevleri sorumluları ve tarihleriyle listele.' },
  { label: 'Bugünün öncelikleri', prompt: 'Bugünün operasyon önceliklerini özetle.' },
  { label: 'Sıcak müşteriler', prompt: 'En sıcak müşterileri ve sonraki adımları göster.' },
  { label: 'Yeni portföy oluştur', prompt: 'Yeni portföy oluşturma akışını başlat.' },
  { label: 'Kampanya durumu', prompt: 'Aktif kampanyaların durumunu özetle.' },
];

const shortcuts = [
  { label: 'Yazılımcı', href: '/fabrika/yazilimci', icon: Code2, tone: 'violet' },
  { label: 'Çalışanlar', href: '/fabrika/sirket', icon: Users, tone: 'amber' },
  { label: 'Takvim', href: '/fabrika/takvim', icon: CalendarDays, tone: 'rose' },
  { label: 'Şirket', href: '/fabrika/sirket', icon: Building2, tone: 'blue' },
  { label: 'Belge', href: '/fabrika/belgeler', icon: FileText, tone: 'amber' },
  { label: 'WhatsApp', href: '/fabrika/whatsapp', icon: MessageCircle, tone: 'green' },
  { label: 'Asistan', href: '/fabrika/asistan', icon: Bot, tone: 'blue' },
] as const;

const toneClasses = {
  cyan: 'border-cyan-300/35 bg-cyan-300/[0.06] text-cyan-200 hover:border-cyan-200/65',
  blue: 'border-blue-400/35 bg-blue-400/[0.07] text-blue-200 hover:border-blue-300/65',
  rose: 'border-rose-400/35 bg-rose-400/[0.07] text-rose-200 hover:border-rose-300/65',
  amber: 'border-amber-300/35 bg-amber-300/[0.07] text-amber-100 hover:border-amber-200/65',
  green: 'border-emerald-300/35 bg-emerald-300/[0.07] text-emerald-100 hover:border-emerald-200/65',
  violet: 'border-violet-400/35 bg-violet-400/[0.07] text-violet-200 hover:border-violet-300/65',
} as const;

function BceoWordmark() {
  return (
    <a href="/fabrika/akilli-panel" className="shrink-0" aria-label="Business CEO AI ana ekran">
      <span className="block text-[1.6rem] font-black leading-none tracking-[-0.08em] sm:text-[2rem]">
        <span className="text-red-500">B</span>
        <span className="text-blue-500">C</span>
        <span className="text-amber-300">E</span>
        <span className="text-white">O</span>
      </span>
      <span className="mt-1 block text-[9px] font-medium tracking-wide text-slate-300 sm:text-[11px]">Business CEO AI</span>
    </a>
  );
}

function HelpBadge({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-help-badge="true"
      aria-label={`${label} hakkında bilgi`}
      title={`${label} hakkında bilgi`}
      className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/60 bg-white text-slate-950 shadow-lg shadow-black/20 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
    >
      <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

type FlowModuleProps = {
  title: string;
  description: string;
  icon: typeof Video;
  tone: keyof typeof toneClasses;
  onClick: () => void;
  className?: string;
};

function FlowModule({ title, description, icon: Icon, tone, onClick, className = '' }: FlowModuleProps) {
  return (
    <article className={`group relative min-w-0 rounded-2xl border bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,.18)] backdrop-blur-xl transition ${toneClasses[tone]} ${className}`}>
      <HelpBadge label={title} />
      <button type="button" onClick={onClick} className="flex h-full min-h-28 w-full items-center gap-3 p-4 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 sm:min-h-32 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-current/25 bg-current/10 sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="block text-sm font-semibold leading-5 text-white sm:text-[15px]">{title}</strong>
          <span className="mt-1 block text-[10px] leading-4 text-slate-400 sm:text-[11px]">{description}</span>
        </span>
      </button>
    </article>
  );
}

function Shortcut({ item }: { item: (typeof shortcuts)[number] }) {
  const Icon = item.icon;
  return (
    <div className={`relative shrink-0 rounded-xl border bg-slate-950/60 backdrop-blur transition ${toneClasses[item.tone]}`}>
      <HelpBadge label={item.label} />
      <a href={item.href} className="flex min-h-20 w-[8.25rem] items-center gap-3 px-3 pr-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 lg:min-h-[5.6rem] lg:w-auto lg:flex-col lg:justify-center lg:gap-1.5 lg:px-2 lg:pr-2 lg:pt-3">
        <Icon className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
        <span className="text-xs font-medium text-slate-100">{item.label}</span>
      </a>
    </div>
  );
}

function useExecutiveAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>(fallbackSuggestions);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/fabrika/general-manager/chat');
      const payload = (await response.json()) as AssistantPayload & { success?: boolean };
      if (!response.ok || payload.success === false) throw new Error('Asistan verileri alınamadı.');
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setContext(payload.context || null);
      setSuggestions(Array.isArray(payload.suggestions) && payload.suggestions.length > 0 ? payload.suggestions : fallbackSuggestions);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asistan verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    const optimistic: AssistantMessage = {
      id: `temporary-${Date.now()}`,
      role: 'patron',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/fabrika/general-manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, clientRequestId: crypto.randomUUID() }),
      });
      const payload = (await response.json()) as AssistantPayload & {
        success?: boolean;
        message?: AssistantMessage;
        error?: string;
      };
      if (!response.ok || payload.success === false || !payload.message) {
        throw new Error(payload.error || 'Mesaj gönderilemedi.');
      }
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        optimistic,
        payload.message as AssistantMessage,
      ]);
      if (payload.context) setContext(payload.context);
    } catch (cause) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError(cause instanceof Error ? cause.message : 'Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  return { messages, context, suggestions, loading, sending, error, sendMessage };
}

function activeWorkflowStatus(draft: ExecutivePortfolioDraft) {
  return getPortfolioWorkflowStatus(draft);
}

function ExecutiveAssistantPanel({
  draft,
  onResume,
  assistant,
}: {
  draft: ExecutivePortfolioDraft;
  onResume: () => void;
  assistant: ReturnType<typeof useExecutiveAssistant>;
}) {
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const status = activeWorkflowStatus(draft);
  const visibleMessages = assistant.messages.slice(-3);
  const metrics = assistant.context?.metrics;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = input;
    setInput('');
    await assistant.sendMessage(value);
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [assistant.messages.length]);

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-slate-700/80 bg-[#091525]/85 shadow-2xl shadow-black/25 backdrop-blur-xl xl:min-h-0" aria-labelledby="executive-assistant-title">
      <header className="relative overflow-hidden border-b border-slate-800 px-4 py-4 sm:px-5">
        <div className="absolute right-4 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-blue-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2 id="executive-assistant-title" className="text-base font-semibold tracking-wide text-white sm:text-lg">GENEL MÜDÜR YARDIMCISI</h2>
            <p className="mt-1 text-xs text-slate-500">Business CEO AI Asistanı</p>
          </div>
          <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 text-xs font-semibold text-amber-200">
            <Sparkles className="h-4 w-4" /> AI
          </span>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Modüllere erişebilir</span>
          <span className="inline-flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-blue-300" /> İşlemleri gerçekleştirebilir</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> Güvenli ve onaylı</span>
        </div>
      </header>

      {status && (
        <button type="button" onClick={onResume} className="mx-4 mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-left transition hover:border-emerald-200/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:mx-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/20 text-emerald-200"><LoaderCircle className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200">Aktif işlem · Adım {status.step}/6</span>
            <span className="mt-1 block truncate text-xs text-slate-300">{status.label}{status.progress > 0 ? ` · %${status.progress}` : ''}</span>
          </span>
          <span className="rounded-lg border border-emerald-300/25 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100">Devam et</span>
        </button>
      )}

      <div ref={chatRef} className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-200"><Bot className="h-4 w-4" /></span>
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-700 bg-slate-900/75 px-3.5 py-3 text-xs leading-5 text-slate-200">
            <strong className="block font-medium text-white">Bugünün özeti hazır.</strong>
            <span className="text-slate-400">{metrics?.overdueTasks || 0} geciken görev · {metrics?.activeConversations || 0} sıcak müşteri · {metrics?.openDeals || 0} yeni fırsat</span>
          </div>
        </div>

        {assistant.loading && visibleMessages.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Doğrulanmış şirket verileri yükleniyor…</div>
        )}
        {visibleMessages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'patron' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-xs leading-5 ${message.role === 'patron' ? 'rounded-tr-md border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-50' : 'rounded-tl-md border-slate-700 bg-slate-900/75 text-slate-200'}`}>
              {message.content}
            </div>
          </div>
        ))}
        {assistant.error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">{assistant.error}</p>}
      </div>

      <div className="border-t border-slate-800 px-4 py-3 sm:px-5">
        <p className="text-[10px] text-slate-500">Önerilen komutlar</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {assistant.suggestions.slice(0, 5).map((suggestion) => (
            <button key={suggestion.label} type="button" onClick={() => void assistant.sendMessage(suggestion.prompt)} className="shrink-0 rounded-full border border-slate-700 px-3 py-1.5 text-[10px] text-slate-300 transition hover:border-cyan-300/45 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              {suggestion.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor="executive-assistant-input">Genel Müdür Yardımcısına yaz</label>
          <input id="executive-assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Bir şey yazın..." className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300" />
          <button type="submit" disabled={assistant.sending || !input.trim()} aria-label="Mesajı gönder" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-slate-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
            {assistant.sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <p className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-600"><ShieldCheck className="h-3 w-3" /> Önemli değişiklikler için onayınız istenir.</p>
      </div>
    </section>
  );
}

function WorkflowCanvas({
  draft,
  onOpen,
}: {
  draft: ExecutivePortfolioDraft;
  onOpen: (source: ExecutiveWorkflowSource, step: ExecutiveWorkflowStep) => void;
}) {
  const resumeSource = draft.source || 'studio';
  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border border-slate-800/80 bg-[#071321]/70 p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-5" aria-label="Portföy işlem akışı">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.045) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
      <div className="relative">
        <div className="grid gap-3 sm:grid-cols-2">
          <FlowModule title="AI Portföy Uzmanı" description="Portföy bul ve ekle" icon={Crosshair} tone="cyan" onClick={() => onOpen('hunter', 'source')} />
          <FlowModule title="AI Stüdyo" description="Yeni portföy oluştur" icon={Video} tone="blue" onClick={() => onOpen('studio', 'source')} />
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 text-center text-[10px] font-medium sm:px-12">
          <span className="relative pt-8 text-cyan-300 before:absolute before:left-1/2 before:top-0 before:h-6 before:w-px before:bg-gradient-to-b before:from-cyan-300 before:to-slate-500">Bulunan portföy</span>
          <span className="relative pt-8 text-blue-300 before:absolute before:left-1/2 before:top-0 before:h-6 before:w-px before:bg-gradient-to-b before:from-blue-300 before:to-slate-500">Yeni portföy</span>
        </div>
        <div className="mx-auto -mt-1 h-4 w-px bg-slate-500 before:absolute" aria-hidden="true" />

        <FlowModule title="Portföyler" description="Seç, düzenle ve onayla" icon={BriefcaseBusiness} tone="rose" onClick={() => onOpen(resumeSource, draft.source ? draft.currentStep : 'source')} className="mx-auto max-w-[30rem]" />

        <div className="mx-auto h-8 w-px bg-gradient-to-b from-slate-500 to-blue-400" aria-hidden="true" />
        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <FlowModule title="AI Reklam Tasarımı" description="Poster hazırla veya atla" icon={ImageIcon} tone="blue" onClick={() => onOpen(resumeSource, draft.source ? 'advertising' : 'source')} />
          <span className="hidden items-center justify-center text-cyan-300 sm:flex" aria-hidden="true">→</span>
          <FlowModule title="AI Pazarlama Uzmanı" description="Ülke ve kanalları seç" icon={Megaphone} tone="amber" onClick={() => onOpen(resumeSource, draft.source ? 'marketing' : 'source')} />
        </div>
      </div>
    </section>
  );
}

export default function ExecutiveFlowDashboard() {
  const workflow = usePortfolioWorkflowController();
  const { draft } = workflow;
  const [topSearch, setTopSearch] = useState('');
  const assistant = useExecutiveAssistant();

  const submitTopSearch = async (event: FormEvent) => {
    event.preventDefault();
    const query = topSearch;
    setTopSearch('');
    await assistant.sendMessage(query);
  };

  const updatedLabel = draft.source
    ? 'Taslak otomatik kaydediliyor'
    : 'Yeni işlem başlatmaya hazır';

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#040b14] text-slate-100 selection:bg-cyan-300/25">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-600/10 blur-[110px]" />
        <div className="absolute right-0 top-1/3 h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.07] blur-[130px]" />
      </div>

      <header className="relative z-30 flex min-h-[5.5rem] items-center gap-3 border-b border-slate-800/80 bg-[#050d17]/90 px-4 backdrop-blur-xl sm:gap-5 sm:px-6">
        <BceoWordmark />
        <form onSubmit={submitTopSearch} className="mx-auto hidden min-w-0 max-w-3xl flex-1 items-center md:flex">
          <Search className="pointer-events-none ml-4 h-5 w-5 text-slate-400" />
          <label htmlFor="executive-top-search" className="sr-only">Ara veya Genel Müdür Yardımcısına komut ver</label>
          <input id="executive-top-search" value={topSearch} onChange={(event) => setTopSearch(event.target.value)} placeholder="Ara veya bir şey oluştur…" className="-ml-9 h-12 w-full rounded-2xl border border-slate-700 bg-slate-950/60 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
        </form>
        <details className="group relative ml-auto">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/65 px-3 text-xs text-slate-200 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Palette className="h-4 w-4 text-cyan-300" />
            <span className="hidden sm:inline">Tasarım</span>
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-700 bg-[#0a1625] p-2 shadow-2xl shadow-black/50">
            <button type="button" className="w-full rounded-lg bg-cyan-300/10 px-3 py-2 text-left text-xs text-cyan-100">AI Akış Merkezi</button>
            <a href="/fabrika" onClick={() => window.localStorage.setItem(DESIGN_STORAGE_KEY, 'classic')} className="mt-1 block rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white">Klasik Komuta Merkezi</a>
          </div>
        </details>
        <button type="button" className="flex h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/65 px-3 text-xs text-slate-200">
          <CircleUserRound className="h-5 w-5" /> <span className="hidden sm:inline">CEO</span> <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </header>

      <main className="relative z-10 grid min-h-[calc(100dvh-5.5rem)] gap-3 p-3 lg:grid-cols-[8.5rem_minmax(0,1fr)] lg:gap-4 lg:p-4">
        <nav className="custom-scrollbar flex gap-2 overflow-x-auto lg:grid lg:grid-cols-1 lg:content-start lg:overflow-visible" aria-label="Hızlı modüller">
          {shortcuts.map((item) => <Shortcut key={item.label} item={item} />)}
        </nav>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,.96fr)_minmax(27rem,1.04fr)]">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-medium text-white">Portföy üretim merkezi</p>
                <p className="mt-1 text-[10px] text-slate-500">İki başlangıç yolu, tek sıralı işlem</p>
              </div>
              <span className="text-[10px] text-slate-500">{updatedLabel}</span>
            </div>
            <WorkflowCanvas draft={draft} onOpen={workflow.openWorkflow} />
          </div>
          <ExecutiveAssistantPanel
            draft={draft}
            onResume={workflow.resumeWorkflow}
            assistant={assistant}
          />
        </div>
      </main>

      <PortfolioWorkflowDialog
        open={workflow.dialogOpen}
        onOpenChange={workflow.onOpenChange}
        draft={draft}
        entryMode={workflow.entryMode}
        onAction={workflow.onAction}
        onFilesSelected={workflow.onFilesSelected}
        onRetryMedia={workflow.onRetryMedia}
        onContinue={workflow.onContinue}
        onClose={workflow.onClose}
      />
    </div>
  );
}
