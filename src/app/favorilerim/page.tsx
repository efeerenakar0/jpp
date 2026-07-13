"use client";
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
              <Link href={`/projeler/${project.slug}`} className="block text-center bg-primary-700 text-white py-2 rounded-md hover:bg-primary-800">
                Detayları İncele
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
