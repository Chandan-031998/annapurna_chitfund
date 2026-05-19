import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/db'
import { verifyToken } from '../utils/jwt'
import { fail } from '../utils/response'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        name: string
        email: string
        role: string
      }
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

  if (!token) {
    return fail(res, 401, 'Authentication token is required')
  }

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, full_name: true, email: true, role: true }
    })

    if (!user) {
      return fail(res, 401, 'User session is no longer valid')
    }

    req.user = {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: String(user.role || 'member').toUpperCase()
    }
    return next()
  } catch {
    return fail(res, 401, 'Invalid or expired token')
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 401, 'Authentication is required')
    }

    if (!roles.map((role) => role.toUpperCase()).includes(req.user.role.toUpperCase())) {
      return fail(res, 403, 'You do not have permission to perform this action')
    }

    return next()
  }
}
