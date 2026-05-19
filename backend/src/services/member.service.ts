import { prisma } from '../config/db'

export const memberService = {
  all() {
    return prisma.member.findMany({ orderBy: { created_at: 'desc' } })
  }
}
