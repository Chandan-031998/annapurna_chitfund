import jwt, { SignOptions } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'annapurna_secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JwtPayload {
  id: number
  email: string
  role: string
}

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions)
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
