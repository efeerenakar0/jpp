'use client';
import React from 'react';

interface WebsitePreviewProps {
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  status: 'Hazırlanıyor...' | 'Hazır!' | 'Hata' | 'Bekliyor';
  html?: string;
}

export default function WebsitePreview({ companyName, primaryColor, accentColor, logoUrl, status, html }: WebsitePreviewProps) {
  const handleDownload = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_website.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col mt-6">
      <div className="bg-white/10 px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="bg-black/20 text-white/70 text-xs px-4 py-1 rounded-md max-w-sm truncate flex-1 mx-4 text-center">
          {companyName ? `${companyName.replace(/[^a-z0-9]/gi, '').toLowerCase()}.com` : 'ornek-site.com'}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            status === 'Hazır!' ? 'bg-green-500/20 text-green-300' :
            status === 'Hazırlanıyor...' ? 'bg-yellow-500/20 text-yellow-300' :
            status === 'Hata' ? 'bg-red-500/20 text-red-300' :
            'bg-white/10 text-white/50'
          }`}>
            {status}
          </span>
          {status === 'Hazır!' && (
            <button 
              onClick={handleDownload}
              className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded transition"
            >
              İndir
            </button>
          )}
        </div>
      </div>
      
      <div className="relative aspect-video w-full bg-gray-100 flex-1 overflow-hidden">
        {html && status === 'Hazır!' ? (
          <iframe 
            srcDoc={html} 
            title="Website Preview" 
            className="w-full h-full border-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col relative">
            <header className="p-4 flex justify-between items-center text-white" style={{ backgroundColor: primaryColor || '#1a365d' }}>
              <div className="font-bold flex items-center gap-2">
                {logoUrl && <img src={logoUrl} alt="logo" className="h-6" />}
                {companyName || 'Şirket Adı'}
              </div>
              <div className="flex gap-4 text-sm opacity-80">
                <span>Ana Sayfa</span>
                <span>Hakkımızda</span>
                <span>İletişim</span>
              </div>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ background: `linear-gradient(to bottom right, #f3f4f6, #e5e7eb)` }}>
              <h1 className="text-3xl font-bold mb-4" style={{ color: primaryColor || '#1a365d' }}>
                Hayalinizdeki Eve Giden Yol
              </h1>
              <p className="text-gray-600 max-w-md mb-6">
                Profesyonel ekibimizle gayrimenkul yatırımlarınıza değer katıyoruz.
              </p>
              <div className="px-6 py-2 rounded-full text-white font-medium shadow-lg" style={{ backgroundColor: accentColor || '#c6a55a' }}>
                Portföyleri İncele
              </div>
            </div>
            {status === 'Hazırlanıyor...' && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="font-medium animate-pulse">Siteniz Yapay Zeka Tarafından Kodlanıyor...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
