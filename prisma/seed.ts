import { PrismaClient } from '@prisma/client'
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
      shortDescription: 'Kargıcak\'ın en prestijli lokasyonunda, deniz manzaralı ve ultra lüks donatılara sahip eşsiz bir yaşam projesi.',
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
