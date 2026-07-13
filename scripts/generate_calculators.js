import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/components/calculators/InstallmentCalculator.tsx': `"use client";
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
`,
  'src/components/calculators/ROICalculator.tsx': `"use client";
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
`,
  'src/components/calculators/CurrencyConverter.tsx': `"use client";
import { useState, useEffect } from "react";

export default function CurrencyConverter({ basePrice = 100000, baseCurrency = "EUR" }) {
  const [rates, setRates] = useState({ USD: 1.1, GBP: 0.85, TRY: 35.0, RUB: 100.0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Demo API fetch for rates
    // In a real app, you would call your API route which calls exchangerate API
  }, []);

  return (
    <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">Döviz Çevirici</h3>
      <div className="text-2xl font-bold text-primary-800 mb-4">
        {basePrice.toLocaleString()} {baseCurrency}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
          <span className="font-medium">USD ($)</span>
          <span className="font-bold">{(basePrice * rates.USD).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
          <span className="font-medium">GBP (£)</span>
          <span className="font-bold">{(basePrice * rates.GBP).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
          <span className="font-medium">TRY (₺)</span>
          <span className="font-bold">{(basePrice * rates.TRY).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
          <span className="font-medium">RUB (₽)</span>
          <span className="font-bold">{(basePrice * rates.RUB).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-4 text-center">Kur bilgileri gösterge niteliğindedir.</p>
    </div>
  );
}
`,
  'src/app/hesaplama-araclari/page.tsx': `import InstallmentCalculator from "@/components/calculators/InstallmentCalculator";
import ROICalculator from "@/components/calculators/ROICalculator";
import CurrencyConverter from "@/components/calculators/CurrencyConverter";

export const metadata = {
  title: "Hesaplama Araçları | Jasmine Proje Pazarlama"
};

export default function CalculatorsPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-4xl font-serif font-bold text-center mb-12">Yatırım ve Hesaplama Araçları</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <InstallmentCalculator />
        <ROICalculator />
        <CurrencyConverter />
      </div>
    </div>
  );
}
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
