import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim()
  const seedAgentPassword = process.env.SEED_AGENT_PASSWORD?.trim()

  if (!seedAdminPassword || !seedAgentPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD and SEED_AGENT_PASSWORD must be configured before seeding users.'
    )
  }

  const adminPassword = await hash(seedAdminPassword, 12)
  const agentPassword = await hash(seedAgentPassword, 12)

  await prisma.user.upsert({
    where: { email: 'admin@jasmine.com' },
    update: {},
    create: {
      email: 'admin@jasmine.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  await prisma.user.upsert({
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
  await prisma.project.upsert({
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
