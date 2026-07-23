import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

// GET: Dönüştürülmeyi bekleyen GREEN durumundaki ilanları getirir
export async function GET() {
  try {
    const listings = await prisma.huntedListing.findMany({
      where: {
        status: 'GREEN',
        syncedToSite: false,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(listings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

// POST: İlanı projeye dönüştürür
export async function POST(request: Request) {
  try {
    const { listingId } = await request.json();
    
    const listing = await prisma.huntedListing.findUnique({
      where: { id: listingId },
    });
    
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    
    // Slug üretimi
    const baseSlug = listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    
    // SEO İçeriği Üret
    const prompt = PROMPTS.seoGenerator({
      title: listing.title,
      location: listing.location || '',
      price: listing.price || '',
      roomCount: listing.roomCount || '',
      area: listing.area || ''
    });
    
    const aiResponse = await callAI([{ role: 'user', content: prompt }], 'seo');
    const seoData = parseJSONResponse(aiResponse.content) as { seoTitle?: string, metaDescription?: string, htmlDescription?: string } | null;
    
    // Proje oluştur
    const project = await prisma.project.create({
      data: {
        name: listing.title,
        slug,
        location: listing.location || 'Belirtilmedi',
        status: 'Satışta',
        image: listing.imageUrl || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        shortDescription: seoData?.metaDescription || listing.notes || 'Yeni proje',
        description: seoData?.htmlDescription || 'Detaylı açıklama hazırlanıyor.',
        features: [],
        deliveryDate: 'Hemen Teslim',
        price: listing.price || 'Fiyat Sorunuz',
        published: true,
      }
    });
    
    // Unit ekleyelim
    if (listing.roomCount || listing.area) {
      await prisma.unit.create({
        data: {
          projectId: project.id,
          type: listing.roomCount || 'Bilinmiyor',
          area: listing.area || 'Bilinmiyor',
          price: listing.price,
        }
      });
    }
    
    // İlanı güncelle
    await prisma.huntedListing.update({
      where: { id: listingId },
      data: {
        syncedToSite: true,
        syncedProjectId: project.id
      }
    });
    
    // Bildirim oluştur
    await prisma.notification.create({
      data: {
        type: 'WEBSITE_GENERATED',
        title: 'Yeni Portföy Eklendi',
        message: `${listing.title} adlı ilan başarıyla web sitesine proje olarak eklendi.`,
        link: `/projeler/${slug}`
      }
    });
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Portfolio sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
