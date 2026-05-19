import { prisma } from '../config/db'

export const authService = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  }
}
