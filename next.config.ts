import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const legacyPublicRedirects = [
  { source: '/hakkimizda', destination: '/tr#about' },
  { source: '/hizmetler', destination: '/tr#platform' },
  { source: '/iletisim', destination: '/tr/contact' },
  { source: '/projeler/:path*', destination: '/tr/realestate' },
  { source: '/blog/:path*', destination: '/tr' },
  { source: '/neden-alanya', destination: '/tr/realestate' },
  { source: '/hesaplama-araclari', destination: '/tr/realestate' },
  { source: '/favorilerim', destination: '/tr/realestate' },
  { source: '/karsilastir', destination: '/tr/realestate' },
  {
    source: '/is-ortakligi',
    destination: '/tr/contact?sector=real-estate&intent=founding-partner',
  },
  { source: '/sss', destination: '/tr#faq' },
  { source: '/gizlilik-politikasi', destination: '/tr/legal/privacy' },
  { source: '/kullanim-kosullari', destination: '/tr/legal/terms' },
  { source: '/cerez-politikasi', destination: '/tr/legal/cookies' },
  { source: '/kvkk-aydinlatma-metni', destination: '/tr/legal/kvkk' },
] as const;

const nextConfig: NextConfig = {
  async redirects() {
    return legacyPublicRedirects.map((redirect) => ({
      ...redirect,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/video-preview/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; media-src 'self' https: blob:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
          },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
