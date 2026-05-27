export type Role = 'ADMIN' | 'MEMBER'

export interface AuthUser {
  id: number
  name: string
  email: string
  phone?: string
  role: Role
  isActive?: boolean
}

export interface AuthResponse {
  user: AuthUser
  token: string
}
