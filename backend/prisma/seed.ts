import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@annapurna.local' },
    update: {},
    create: {
      full_name: 'Annapurna Admin',
      email: 'admin@annapurna.local',
      mobile: '9999999999',
      role: 'admin',
      password: passwordHash
    }
  })

  const group = await prisma.chitGroup.create({
    data: {
      group_name: `Annapurna Layout Group ${Date.now().toString().slice(-4)}`,
      monthly_amount: 5000,
      total_members: 20,
      duration_months: 20,
      start_date: new Date()
    }
  })

  const existingMember = await prisma.member.findFirst({
    where: { OR: [{ member_code: 'MEM-001' }, { mobile: '9000000001' }] }
  })

  if (!existingMember) {
    await prisma.member.create({
      data: {
      member_code: 'MEM-001',
      full_name: 'Sample Member',
      mobile: '9000000001',
      email: 'member@annapurna.local',
      address: 'Annapurna Layout',
      group_id: group.id
      }
    })
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
