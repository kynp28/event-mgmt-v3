import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)

  // 1 Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventcore.com' },
    update: {},
    create: {
      email: 'admin@eventcore.com',
      password: passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
  })

  // 1 Approved Organizer
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@eventcore.com' },
    update: {},
    create: {
      email: 'organizer@eventcore.com',
      password: passwordHash,
      name: 'Approved Organizer',
      role: 'ORGANIZER',
      organizerProfile: {
        create: {
          companyName: 'Awesome Events Co.',
          status: 'APPROVED',
        }
      }
    },
  })

  // 1 Pending Organizer
  const pendingOrganizer = await prisma.user.upsert({
    where: { email: 'pending@eventcore.com' },
    update: {},
    create: {
      email: 'pending@eventcore.com',
      password: passwordHash,
      name: 'Pending Organizer',
      role: 'ORGANIZER',
      organizerProfile: {
        create: {
          companyName: 'Pending Events Co.',
          status: 'PENDING',
        }
      }
    },
  })

  // 1 Vendor
  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@eventcore.com' },
    update: {},
    create: {
      email: 'vendor@eventcore.com',
      password: passwordHash,
      name: 'Vendor User',
      role: 'VENDOR',
    },
  })

  // 1 Sample Event with Zones and Booths
  const event = await prisma.event.upsert({
    where: { id: 'sample-event-1' }, // we can't upsert by ID if it's cuid by default without providing it, but we can just create it if not exists.
    // Actually, we don't have a unique field on Event. Let's just findFirst or create.
    update: {},
    create: {
      id: 'sample-event-1',
      organizerId: organizer.id,
      name: 'Tech Expo 2026',
      description: 'The biggest tech expo of the year',
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-03T23:59:59Z'),
      location: 'Bangkok International Trade & Exhibition Centre',
      status: 'PUBLISHED',
      zones: {
        create: [
          {
            id: 'zone-a',
            name: 'Zone A - Startups',
            color: '#FF5733',
          },
          {
            id: 'zone-b',
            name: 'Zone B - Enterprises',
            color: '#33FF57',
          }
        ]
      }
    }
  })

  // Create booths if they don't exist
  const existingBooths = await prisma.booth.count({ where: { eventId: event.id } })
  if (existingBooths === 0) {
    await prisma.booth.createMany({
      data: [
        {
          eventId: event.id,
          zoneId: 'zone-a',
          code: 'A01',
          price: 5000.00,
          status: 'AVAILABLE',
        },
        {
          eventId: event.id,
          zoneId: 'zone-a',
          code: 'A02',
          price: 5000.00,
          status: 'AVAILABLE',
        },
        {
          eventId: event.id,
          zoneId: 'zone-b',
          code: 'B01',
          price: 15000.00,
          status: 'AVAILABLE',
        }
      ]
    })
  }

  console.log({ admin, organizer, vendor, pendingOrganizer, event })
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
