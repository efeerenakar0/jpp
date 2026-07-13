"use client";
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
