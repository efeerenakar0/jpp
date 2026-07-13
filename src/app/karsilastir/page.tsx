"use client";
import { useEffect, useState } from "react";
import { siteContent } from "@/data/site-content";

export default function ComparePage() {
  const [compareList, setCompareList] = useState<string[]>([]);

  useEffect(() => {
    const list = JSON.parse(localStorage.getItem("compareList") || "[]");
    setCompareList(list);
  }, []);

  const projects = siteContent.projects.filter(p => compareList.includes(p.slug));

  if (projects.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 min-h-[60vh] text-center">
        <h1 className="text-4xl font-serif font-bold mb-8">Karşılaştırma</h1>
        <p className="text-gray-500">Karşılaştırmak için lütfen projeler sayfasından en az bir proje seçin.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20 min-h-[60vh]">
      <h1 className="text-4xl font-serif font-bold mb-8">Proje Karşılaştırma</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-700 w-48">Özellikler</th>
              {projects.map(p => (
                <th key={p.id} className="p-4 border-b border-gray-200 bg-white align-top">
                  <img src={p.image} className="w-full h-32 object-cover rounded-md mb-2" />
                  <h3 className="text-lg font-bold">{p.name}</h3>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Lokasyon</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200">{p.location}</td>)}
            </tr>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Durum</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200">{p.status}</td>)}
            </tr>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Teslim Tarihi</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200">{p.deliveryDate}</td>)}
            </tr>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Daire Tipleri</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200">{p.types.join(", ")}</td>)}
            </tr>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Büyüklük (m²)</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200">{p.area}</td>)}
            </tr>
            <tr>
              <td className="p-4 border-b border-gray-200 font-medium bg-gray-50">Fiyat</td>
              {projects.map(p => <td key={p.id} className="p-4 border-b border-gray-200 font-bold text-primary-700">{p.price}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
