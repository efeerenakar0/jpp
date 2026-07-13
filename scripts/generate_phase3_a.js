import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/middleware.ts': `import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/admin/giris');
    
    // RBAC logic
    if (req.nextUrl.pathname.startsWith('/admin') && !isAuthPage) {
      if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/giris', req.url));
      }
    }

    if (req.nextUrl.pathname.startsWith('/emlakci-panel')) {
      if (token?.role !== 'AGENT' && token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/giris', req.url));
      }
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true, // We handle authorization in the middleware function
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/emlakci-panel/:path*'],
};
`,
  'next.config.mjs': `/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  images: {
    domains: ['images.unsplash.com', 'res.cloudinary.com'],
  },
};

export default nextConfig;
`,
  'src/app/api/contact/route.ts': `import { NextResponse } from 'next/server';
// import { Ratelimit } from "@upstash/ratelimit";
// import { Redis } from "@upstash/redis";

// Mock Rate Limiting
const rateLimitMap = new Map();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const now = Date.now();
    const limit = 5;
    const windowMs = 60000;
    
    const userLimits = rateLimitMap.get(ip) || { count: 0, timestamp: now };
    
    if (now - userLimits.timestamp > windowMs) {
      userLimits.count = 1;
      userLimits.timestamp = now;
    } else {
      userLimits.count++;
      if (userLimits.count > limit) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
    rateLimitMap.set(ip, userLimits);

    const body = await req.json();
    
    // In a real app, validate with zod
    // Save to DB via Prisma
    
    return NextResponse.json({ success: true, message: "Talebiniz başarıyla alındı." });
  } catch (error) {
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}
`,
  '.github/workflows/ci.yml': `name: Jasmine CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'
    - run: npm ci
    - run: npx prisma generate
    - run: npm run build
    # - run: npm run test
    # - run: npm run test:e2e
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
