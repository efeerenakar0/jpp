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
  callToAction,
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
    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = { description1: body };
    }
    
    let parsedHeadline: any = {};
    try {
      parsedHeadline = JSON.parse(headline);
    } catch {
      parsedHeadline = { headline1: headline };
    }

    return (
      <div className="space-y-4 text-sm text-gray-300">
        <div className="space-y-2">
          {['headline1', 'headline2', 'headline3'].map((key, i) => (
            parsedHeadline[key] && (
              <div key={key} className="flex justify-between items-start gap-4 p-2 bg-gray-800/50 rounded-lg">
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Başlık {i + 1}</span>
                  <p className="font-medium">{parsedHeadline[key]}</p>
                </div>
                <button 
                  onClick={() => handleCopy(parsedHeadline[key], `h${i}`)}
                  className="p-1.5 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white"
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
              <div key={key} className="flex justify-between items-start gap-4 p-2 bg-gray-800/50 rounded-lg">
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Açıklama {i + 1}</span>
                  <p>{parsedBody[key]}</p>
                </div>
                <button 
                  onClick={() => handleCopy(parsedBody[key], `d${i}`)}
                  className="p-1.5 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white"
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
    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = { caption: body, hashtags: [] };
    }

    const content = `${parsedBody.caption || body}\n\n${(parsedBody.hashtags || []).join(' ')}`;

    return (
      <div className="space-y-3">
        <div className="relative group p-3 bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{parsedBody.caption || body}</p>
          {parsedBody.hashtags && parsedBody.hashtags.length > 0 && (
             <p className="text-sm text-blue-400 mt-2">{parsedBody.hashtags.join(' ')}</p>
          )}
          <button 
            onClick={() => handleCopy(content, 'ig')}
            className="absolute top-2 right-2 p-1.5 bg-gray-900/80 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
          >
            {copiedSection === 'ig' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  const renderWhatsApp = () => {
    return (
      <div className="relative group p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-lg">
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{body}</p>
        <button 
          onClick={() => handleCopy(body, 'wa')}
          className="absolute top-2 right-2 p-1.5 bg-gray-900/80 hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
        >
          {copiedSection === 'wa' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className={`rounded-xl border ${config.border} bg-gray-900/50 overflow-hidden flex flex-col`}>
      <div className={`p-4 border-b border-gray-800 flex items-center justify-between ${config.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <h3 className="font-semibold text-white">{config.title}</h3>
        </div>
        {id && onApprove && (
          <button
            onClick={() => onApprove(id, !approved)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              approved 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
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
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-4"
          >
            <ExternalLink className="w-3 h-3" />
            Hedef Link (İlan / Site)
          </a>
        )}
      </div>

      <div className="px-4 py-3 bg-gray-950 border-t border-gray-800/50 text-xs text-gray-400 flex gap-2">
        <span className="font-medium text-gray-300">Rehber:</span>
        {config.guide}
      </div>
    </div>
  );
}
