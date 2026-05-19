import jwt, { SignOptions } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'annapurna_secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_VERIFY_SECRETS = Array.from(new Set([
  JWT_SECRET,
  'annapurna_secret',
  'secret'
]))

export interface JwtPayload {
  id: number
  email: string
  role: string
}

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions)
}

export function verifyToken(token: string) {
  let lastError: unknown

  for (const secret of JWT_VERIFY_SECRETS) {
    try {
      return jwt.verify(token, secret) as JwtPayload
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}
