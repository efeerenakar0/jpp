"use client";
import { useState } from "react";

export default function ROICalculator({ defaultPrice = 100000 }) {
  const [price, setPrice] = useState(defaultPrice);
  const [monthlyRent, setMonthlyRent] = useState(800);
  const [annualAppreciation, setAnnualAppreciation] = useState(10);

  const annualRent = monthlyRent * 12;
  const roiPct = (annualRent / price) * 100;
  const paybackYears = price / annualRent;

  return (
    <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">Yatırım Getirisi (ROI) Hesaplayıcı</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Daire Fiyatı</label>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full mt-1 p-2 border rounded-md" />
        </div>
        
        <div>
          <label className="block text-sm text-gray-600">Tahmini Aylık Kira Getirisi</label>
          <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(Number(e.target.value))} className="w-full mt-1 p-2 border rounded-md" />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Yıllık Değer Artışı (%)</label>
          <input type="range" min="0" max="30" step="1" value={annualAppreciation} onChange={(e) => setAnnualAppreciation(Number(e.target.value))} className="w-full mt-1" />
          <div className="text-right text-sm font-bold">{annualAppreciation}%</div>
        </div>
        
        <div className="pt-4 border-t border-gray-100 bg-gray-50 p-4 rounded-md">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Yıllık Kira Getirisi (ROI):</span>
            <span className="font-bold text-green-600">% {roiPct.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amortisman Süresi:</span>
            <span className="font-bold">{paybackYears.toFixed(1)} Yıl</span>
          </div>
        </div>
        
        <p className="text-xs text-gray-400 mt-2">
          * Bu hesaplama tamamen tahmini değerlere dayanmaktadır ve yatırım tavsiyesi değildir.
        </p>
      </div>
    </div>
  );
}
