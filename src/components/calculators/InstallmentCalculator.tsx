"use client";
import { useState } from "react";

export default function InstallmentCalculator({ defaultPrice = 100000 }) {
  const [price, setPrice] = useState(defaultPrice);
  const [downPaymentPct, setDownPaymentPct] = useState(30);
  const [installments, setInstallments] = useState(12);

  const downPayment = (price * downPaymentPct) / 100;
  const remaining = price - downPayment;
  const monthly = remaining / installments;

  return (
    <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">Taksit Hesaplayıcı</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Daire Fiyatı (Örn: EUR)</label>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full mt-1 p-2 border rounded-md" />
        </div>
        
        <div>
          <label className="block text-sm text-gray-600">Peşinat Oranı (%)</label>
          <input type="range" min="10" max="90" step="10" value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} className="w-full mt-1" />
          <div className="text-right text-sm font-bold">{downPaymentPct}% ({downPayment.toLocaleString()})</div>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Taksit Sayısı (Ay)</label>
          <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="w-full mt-1 p-2 border rounded-md">
            <option value={6}>6 Ay</option>
            <option value={12}>12 Ay</option>
            <option value={24}>24 Ay</option>
            <option value={36}>36 Ay</option>
          </select>
        </div>
        
        <div className="pt-4 border-t border-gray-100">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Kalan Tutar:</span>
            <span className="font-bold">{remaining.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-900 font-bold">Aylık Taksit:</span>
            <span className="font-bold text-primary-700">{monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })} / Ay</span>
          </div>
        </div>
        
        <button className="w-full bg-primary-700 text-white p-2 rounded-md mt-4 hover:bg-primary-800 transition">
          PDF Olarak İndir (Demo)
        </button>
      </div>
    </div>
  );
}
