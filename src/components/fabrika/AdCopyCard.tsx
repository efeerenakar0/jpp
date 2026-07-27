'use client';

import { useState } from 'react';
import { Check, Copy, Camera, MessageCircle, MonitorPlay, ExternalLink } from 'lucide-react';

interface AdCopyCardProps {
  id?: string;
  platform: 'GOOGLE_ADS' | 'INSTAGRAM' | 'WHATSAPP';
  headline: string;
  body: string;
  callToAction?: string | null;
  targetUrl?: string | null;
  approved: boolean;
  onApprove?: (id: string, approved: boolean) => void;
}

export default function AdCopyCard({
  id,
  platform,
  headline,
  body,
  targetUrl,
  approved,
  onApprove
}: AdCopyCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const platformConfig = {
    GOOGLE_ADS: {
      icon: MonitorPlay,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      title: 'Google Ads',
      guide: 'Google Ads → Yeni Kampanya → Başlık ve Açıklama kısımlarına yapıştırın.'
    },
    INSTAGRAM: {
      icon: Camera,
      color: 'text-pink-400',
      bg: 'bg-gradient-to-br from-purple-500/10 to-pink-500/10',
      border: 'border-pink-500/20',
      title: 'Instagram',
      guide: 'Instagram Gönderi → Açıklama kısmına yapıştırın.'
    },
    WHATSAPP: {
      icon: MessageCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      title: 'WhatsApp',
      guide: 'WhatsApp gruplarına veya müşterilerinize doğrudan gönderin.'
    }
  };

  const config = platformConfig[platform];
  const Icon = config.icon;

  const renderGoogleAds = () => {
    let parsedBody: Record<string, string> = {};
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = { description1: body };
    }
    
    let parsedHeadline: Record<string, string> = {};
    try {
      parsedHeadline = JSON.parse(headline);
    } catch {
      parsedHeadline = { headline1: headline };
    }

    return (
      <div className="space-y-4 text-sm text-slate-300">
        <div className="space-y-2">
          {['headline1', 'headline2', 'headline3'].map((key, i) => (
            parsedHeadline[key] && (
              <div key={key} className="flex justify-between items-start gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div>
                  <span className="mb-1 block text-xs text-slate-500">Başlık {i + 1}</span>
                  <p className="font-medium">{parsedHeadline[key]}</p>
                </div>
                <button 
                  onClick={() => handleCopy(parsedHeadline[key], `h${i}`)}
                  aria-label={`Başlık ${i + 1} metnini kopyala`}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {copiedSection === `h${i}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )
          ))}
        </div>
        
        <div className="space-y-2">
          {['description1', 'description2'].map((key, i) => (
            parsedBody[key] && (
              <div key={key} className="flex justify-between items-start gap-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div>
                  <span className="mb-1 block text-xs text-slate-500">Açıklama {i + 1}</span>
                  <p>{parsedBody[key]}</p>
                </div>
                <button 
                  onClick={() => handleCopy(parsedBody[key], `d${i}`)}
                  aria-label={`Açıklama ${i + 1} metnini kopyala`}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {copiedSection === `d${i}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  const renderInstagram = () => {
    let parsedBody: { caption?: string; hashtags?: string[] } = {};
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = { caption: body, hashtags: [] };
    }

    const content = `${parsedBody.caption || body}\n\n${(parsedBody.hashtags || []).join(' ')}`;

    return (
      <div className="space-y-3">
        <div className="group relative rounded-lg border border-slate-800 bg-slate-950/70 p-3 pr-11">
          <p className="whitespace-pre-wrap text-sm text-slate-300">{parsedBody.caption || body}</p>
          {parsedBody.hashtags && parsedBody.hashtags.length > 0 && (
             <p className="text-sm text-blue-400 mt-2">{parsedBody.hashtags.join(' ')}</p>
          )}
          <button 
            onClick={() => handleCopy(content, 'ig')}
            aria-label="Instagram metnini kopyala"
            className="absolute right-2 top-2 rounded-md bg-slate-900 p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {copiedSection === 'ig' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  const renderWhatsApp = () => {
    return (
      <div className="group relative rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 pr-11">
        <p className="whitespace-pre-wrap text-sm text-slate-300">{body}</p>
        <button 
          onClick={() => handleCopy(body, 'wa')}
          aria-label="WhatsApp metnini kopyala"
          className="absolute right-2 top-2 rounded-md bg-slate-900 p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {copiedSection === 'wa' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border ${config.border} bg-slate-900`}>
      <div className={`flex items-center justify-between border-b border-slate-800 p-4 ${config.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <h3 className="font-semibold text-white">{config.title}</h3>
        </div>
        {id && onApprove && (
          <button
            onClick={() => onApprove(id, !approved)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              approved 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {approved ? 'Onaylandı' : 'Onayla'}
          </button>
        )}
      </div>
      
      <div className="p-4 flex-1">
        {platform === 'GOOGLE_ADS' && renderGoogleAds()}
        {platform === 'INSTAGRAM' && renderInstagram()}
        {platform === 'WHATSAPP' && renderWhatsApp()}
        
        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ExternalLink className="w-3 h-3" />
            Hedef Link (İlan / Site)
          </a>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-400">
        <span className="font-medium text-slate-300">Rehber:</span>
        {config.guide}
      </div>
    </div>
  );
}
