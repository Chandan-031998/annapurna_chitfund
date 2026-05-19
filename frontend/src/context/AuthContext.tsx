import { createContext, ReactNode, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'

const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={useAuth()}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) return useAuth()
  return context
}
