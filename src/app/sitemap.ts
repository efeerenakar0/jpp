import { MetadataRoute } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jasmineprojepazarlama.com';

  const projects = await prisma.project.findMany({ where: { published: true } });
  const posts = await prisma.blogPost.findMany({ where: { published: true } });

  const projectUrls = projects.map((p) => ({
    url: `${baseUrl}/projeler/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as any,
    priority: 0.8,
  }));

  const postUrls = posts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly' as any,
    priority: 0.6,
  }));

  const staticUrls = [
    '',
    '/hakkimizda',
    '/projeler',
    '/hizmetler',
    '/is-ortakligi',
    '/neden-alanya',
    '/iletisim',
    '/sss',
    '/blog',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as any,
    priority: route === '' ? 1.0 : 0.8,
  }));

  return [...staticUrls, ...projectUrls, ...postUrls];
}
