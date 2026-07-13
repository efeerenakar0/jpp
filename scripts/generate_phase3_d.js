import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'public/manifest.json': `{
  "name": "Jasmine Proje Pazarlama",
  "short_name": "Jasmine",
  "description": "Alanya'nın lider gayrimenkul pazarlama firması.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#303d1c",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
`,
  'src/components/common/BottomNav.tsx': `"use client";
import Link from "next/link";
import { Home, Search, Heart, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center p-3 md:hidden z-40 pb-safe">
      <Link href="/" className={\`flex flex-col items-center gap-1 \${pathname === '/' ? 'text-primary-700' : 'text-gray-500'}\`}>
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">Ana Sayfa</span>
      </Link>
      <Link href="/projeler" className={\`flex flex-col items-center gap-1 \${pathname === '/projeler' ? 'text-primary-700' : 'text-gray-500'}\`}>
        <Search className="w-5 h-5" />
        <span className="text-[10px] font-medium">Projeler</span>
      </Link>
      <Link href="/favorilerim" className={\`flex flex-col items-center gap-1 \${pathname === '/favorilerim' ? 'text-primary-700' : 'text-gray-500'}\`}>
        <Heart className="w-5 h-5" />
        <span className="text-[10px] font-medium">Favoriler</span>
      </Link>
      <a href="https://wa.me/905000000000" className="flex flex-col items-center gap-1 text-gray-500">
        <MessageCircle className="w-5 h-5" />
        <span className="text-[10px] font-medium">İletişim</span>
      </a>
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
