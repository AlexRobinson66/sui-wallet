'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useZkLoginSession } from '@/hooks/use-zklogin-session'

interface User {
  address: string
  provider: string
  sub: string
  email?: string
  name?: string
}

interface ZkLoginSession {
  ephemeralKeyPair: string
  zkProof: any
  maxEpoch: number
  userSalt: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasSalt: boolean
  login: (user: User) => void
  logout: () => void
  getZkLoginSession: () => ZkLoginSession | null
  clearZkLoginSession: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const zkLoginSession = useZkLoginSession()

  useEffect(() => {
    // Check for existing session on mount
    const savedUser = localStorage.getItem('sui-wallet-user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Failed to parse saved user:', error)
        localStorage.removeItem('sui-wallet-user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem('sui-wallet-user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('sui-wallet-user')
    // Clear zkLogin session data
    zkLoginSession.clearSession()
  }

  const getZkLoginSession = (): ZkLoginSession | null => {
    return zkLoginSession.getSession()
  }

  const clearZkLoginSession = () => {
    zkLoginSession.clearSession()
  }

  const hasSalt = zkLoginSession.hasSalt()

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    hasSalt,
    login,
    logout,
    getZkLoginSession,
    clearZkLoginSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
