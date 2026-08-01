'use client';

import {
  CalendarPlus,
  ContactRound,
  FilePlus2,
  Home,
  Loader2,
  Megaphone,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

type SearchResult = {
  id: string;
  category: string;
  label: string;
  description: string;
  href: string;
};

const quickActions = [
  {
    label: 'Yeni portföy',
    description: 'Portföy oluşturma ekranını aç',
    href: '/fabrika/portfoyler?action=new',
    icon: Home,
    shortcut: 'P',
  },
  {
    label: 'Yeni müşteri',
    description: 'CRM müşteri formunu aç',
    href: '/fabrika/crm?action=new',
    icon: UserRound,
    shortcut: 'M',
  },
  {
    label: 'Yeni randevu veya görev',
    description: 'Takvim kayıt formunu aç',
    href: '/fabrika/takvim?action=new',
    icon: CalendarPlus,
    shortcut: 'T',
  },
  {
    label: 'Yeni kampanya',
    description: 'Pazarlama akışını aç',
    href: '/fabrika/pazarlamaci?action=new',
    icon: Megaphone,
    shortcut: 'K',
  },
  {
    label: 'Yeni belge',
    description: 'Belge kataloğunu aç',
    href: '/fabrika/belgeler?action=new',
    icon: FilePlus2,
    shortcut: 'B',
  },
  {
    label: 'Stüdyo çalışması',
    description: 'Görsel çalışma alanını aç',
    href: '/fabrika/studyo?action=new',
    icon: Sparkles,
    shortcut: 'S',
  },
] as const;

export default function FabrikaCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (normalized.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/fabrika/search?q=${encodeURIComponent(normalized)}&limit=6`,
          { cache: 'no-store', signal: controller.signal }
        );
        const data = (await response.json()) as {
          success?: boolean;
          results?: SearchResult[];
        };
        setResults(response.ok && data.success ? data.results || [] : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const grouped = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((groups, result) => {
      (groups[result.category] ||= []).push(result);
      return groups;
    }, {});
  }, [results]);

  function navigate(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setResults([]);
      setLoading(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <CommandDialog
      className="top-[12vh] w-[min(44rem,calc(100vw-1rem))] max-w-none translate-y-0 border-slate-700 bg-slate-950 text-slate-100 shadow-2xl"
      description="Şirket kayıtlarında ara veya hızlı işlem başlat"
      onOpenChange={handleOpenChange}
      open={open}
      showCloseButton
      title="Panelde ara"
    >
      <Command className="bg-slate-950 text-slate-100">
        <CommandInput
          autoFocus
          className="h-11 text-base text-slate-100 placeholder:text-slate-500"
          onValueChange={setQuery}
          placeholder="Müşteri, telefon, portföy, görev, belge veya kampanya ara…"
          value={query}
        />
        <CommandList className="max-h-[min(65vh,34rem)] px-1 pb-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Aranıyor…
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <CommandEmpty className="py-10 text-slate-400">
              <Search className="mx-auto mb-3 h-6 w-6 text-slate-600" />
              Bu şirkette eşleşen kayıt bulunamadı.
            </CommandEmpty>
          )}

          {query.trim().length < 2 && (
            <CommandGroup heading="Hızlı işlemler">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    className="min-h-12 text-slate-200 data-selected:bg-emerald-500/10 data-selected:text-emerald-200"
                    key={action.href}
                    onSelect={() => navigate(action.href)}
                    value={action.label}
                  >
                    <Icon className="h-4 w-4 text-emerald-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{action.label}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {action.description}
                      </span>
                    </span>
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {!loading &&
            Object.entries(grouped).map(([category, items], index) => (
              <div key={category}>
                {index > 0 && <CommandSeparator className="bg-slate-800" />}
                <CommandGroup heading={category}>
                  {items.map((item) => (
                    <CommandItem
                      className="min-h-12 text-slate-200 data-selected:bg-emerald-500/10 data-selected:text-emerald-200"
                      key={`${item.category}:${item.id}`}
                      onSelect={() => navigate(item.href)}
                      value={`${item.label} ${item.description}`}
                    >
                      <ContactRound className="h-4 w-4 text-slate-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
