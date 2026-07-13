import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/app/emlakci-panel/page.tsx': `import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/admin/LogoutButton";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function AgentPanel() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "AGENT") {
    redirect("/admin/giris"); // Veya emlakçı özel girişine yönlendir
  }

  const projects = await prisma.project.findMany({ where: { published: true } });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-gray-900">Emlakçı Portalı</h1>
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-700">Hoş geldiniz, {session.user?.name}</span>
            <div className="bg-white p-1 rounded-md shadow-sm border border-gray-200">
              <LogoutButton />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Aktif Projeler</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">{projects.length}</p>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Portföyünüzdeki Müşteriler (Lead)</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">0</p>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Onaylanan Satışlar</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">0</p>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Proje Dokümanları & Fiyat Listeleri</h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">Proje Adı</th>
                <th className="p-4 text-sm font-medium text-gray-500">Lokasyon</th>
                <th className="p-4 text-sm font-medium text-gray-500">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{p.location}</td>
                  <td className="p-4 flex gap-3">
                    <button className="text-primary-600 text-sm hover:underline">Fiyat Listesi İndir</button>
                    <button className="text-primary-600 text-sm hover:underline">Broşür İndir</button>
                    <button className="text-primary-600 text-sm hover:underline">Görselleri İndir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`,
  'src/app/favorilerim/page.tsx': `"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { siteContent } from "@/data/site-content"; // Fallback static data if DB not fully integrated

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // In a real app with logged in user, fetch from DB
    // Here we just use localStorage for demo
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    setFavorites(favs);
  }, []);

  const favoriteProjects = siteContent.projects.filter(p => favorites.includes(p.slug));

  return (
    <div className="container mx-auto px-4 py-20 min-h-[60vh]">
      <h1 className="text-4xl font-serif font-bold mb-8">Favori Projelerim</h1>
      
      {favorites.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-gray-500 mb-4">Henüz favorilere eklediğiniz bir proje bulunmuyor.</p>
          <Link href="/projeler" className="text-primary-700 font-medium hover:underline">
            Projeleri İncele
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {favoriteProjects.map(project => (
            <div key={project.id} className="border border-gray-200 p-4 rounded-md shadow-sm">
              <img src={project.image} className="w-full h-48 object-cover rounded-md mb-4" />
              <h3 className="text-xl font-bold mb-2">{project.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{project.location}</p>
              <Link href={\`/projeler/\${project.slug}\`} className="block text-center bg-primary-700 text-white py-2 rounded-md hover:bg-primary-800">
                Detayları İncele
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`,
  'src/app/karsilastir/page.tsx': `"use client";
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
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
