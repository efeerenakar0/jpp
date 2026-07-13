import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  '.env.example': `DATABASE_URL="postgresql://user:password@localhost:5432/jasmine"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-me-in-production"
# SMTP
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user"
SMTP_PASS="pass"
# API Keys
EXCHANGE_RATE_API_KEY="your_api_key"
NEXT_PUBLIC_MAPS_API_KEY="your_maps_key"
`,
  'prisma/seed.ts': `import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await hash('admin123', 10)
  const agentPassword = await hash('agent123', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jasmine.com' },
    update: {},
    create: {
      email: 'admin@jasmine.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  const agent = await prisma.user.upsert({
    where: { email: 'agent@example.com' },
    update: {},
    create: {
      email: 'agent@example.com',
      name: 'Agent User',
      password: agentPassword,
      role: 'AGENT',
    },
  })

  // Projects
  const p1 = await prisma.project.upsert({
    where: { slug: 'state-of-art-residence' },
    update: {},
    create: {
      slug: 'state-of-art-residence',
      name: 'State of Art Residence',
      location: 'Kargıcak, Alanya',
      status: 'Satışta',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800',
      shortDescription: 'Kargıcak\\'ın en prestijli lokasyonunda, deniz manzaralı ve ultra lüks donatılara sahip eşsiz bir yaşam projesi.',
      description: 'Detaylı proje açıklaması burada yer alacaktır...',
      features: ['Deniz Manzarası', 'Açık/Kapalı Havuz', 'Spa & Hamam', 'Fitness', 'Sinema Salonu', '7/24 Güvenlik'],
      deliveryDate: 'Aralık 2025',
      price: '250000', // Example numeric or string
      published: true,
      units: {
        create: [
          { type: '1+1', area: '55m²' },
          { type: '2+1', area: '85m²' },
        ]
      }
    }
  })

  console.log('Seed completed.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
`,
  'src/lib/auth.ts': `import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) return null;

        const isPasswordValid = await compare(credentials.password, user.password);
        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/admin/giris',
  },
  session: { strategy: "jwt" }
};
`,
  'src/app/api/auth/[...nextauth]/route.ts': `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`,
  'src/components/common/Providers.tsx': `'use client';
import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
`,
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
