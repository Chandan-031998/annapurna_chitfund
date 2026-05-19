import { api } from './api'
import { AuthResponse, AuthUser } from '../types/auth.types'

export const authService = {
  async login(email: string, password: string) {
    const response = await api.post<AuthResponse>('/auth/login', { email, password })
    return response.data
  },
  async register(payload: { name: string; email: string; phone?: string; password: string; role: string }) {
    const response = await api.post<AuthResponse>('/auth/register', payload)
    return response.data
  },
  async profile() {
    const response = await api.get<{ user: AuthUser }>('/auth/profile')
    return response.data.user
  }
}
