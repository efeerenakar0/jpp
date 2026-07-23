'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

type HuntingStatus = 'YELLOW' | 'RED' | 'GREEN';

interface Listing {
  id: string;
  title: string;
  price?: string | null;
  location?: string | null;
  sourceUrl: string;
  status: HuntingStatus;
}

interface StatusBoardProps {
  listings: Listing[];
  onStatusChange: (id: string, newStatus: HuntingStatus) => void;
  onDeleteListing?: (id: string) => void;
}

export default function StatusBoard({ listings, onStatusChange, onDeleteListing }: StatusBoardProps) {
  const yellowListings = listings.filter((l) => l.status === 'YELLOW');
  const redListings = listings.filter((l) => l.status === 'RED');
  const greenListings = listings.filter((l) => l.status === 'GREEN');

  const Column = ({ 
    title, 
    colorClass, 
    items, 
    targetStatuses 
  }: { 
    title: string; 
    colorClass: string; 
    items: Listing[];
    targetStatuses: { label: string; status: HuntingStatus; btnClass: string }[];
  }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex flex-col h-full">
      <div className={`text-lg font-bold mb-4 flex items-center justify-between pb-2 border-b border-gray-700/50 ${colorClass}`}>
        <span>{title}</span>
        <span className="bg-gray-900 px-2.5 py-0.5 rounded-full text-sm">{items.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {items.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">İlan yok</div>
        ) : (
          items.map((listing) => (
            <div key={listing.id} className="relative bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors group">
              {onDeleteListing && (
                <button
                  onClick={() => onDeleteListing(listing.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                  title="İlanı Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <h4 className="font-medium text-gray-200 text-sm line-clamp-2 mb-2 pr-6" title={listing.title}>
                {listing.title}
              </h4>
              <div className="text-xs text-gray-400 space-y-1 mb-3">
                {listing.price && <div>💰 {listing.price}</div>}
                {listing.location && <div>📍 {listing.location}</div>}
                <div className="truncate">🔗 <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Kaynağa Git</a></div>
              </div>
              <div className="flex gap-2">
                {targetStatuses.map((ts) => (
                  <button
                    key={ts.status}
                    onClick={() => onStatusChange(listing.id, ts.status)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${ts.btnClass}`}
                  >
                    {ts.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
      <Column 
        title="🟡 Pazarlıkta" 
        colorClass="text-yellow-400" 
        items={yellowListings} 
        targetStatuses={[
          { label: 'Elendi', status: 'RED', btnClass: 'bg-red-500/10 text-red-400 hover:bg-red-500/20' },
          { label: 'Avlandı', status: 'GREEN', btnClass: 'bg-green-500/10 text-green-400 hover:bg-green-500/20' }
        ]} 
      />
      <Column 
        title="🔴 Elendi" 
        colorClass="text-red-400" 
        items={redListings} 
        targetStatuses={[
          { label: 'Geri Al', status: 'YELLOW', btnClass: 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' }
        ]} 
      />
      <Column 
        title="🟢 Avlandı" 
        colorClass="text-green-400" 
        items={greenListings} 
        targetStatuses={[
          { label: 'Geri Al', status: 'YELLOW', btnClass: 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' }
        ]} 
      />
    </div>
  );
}
