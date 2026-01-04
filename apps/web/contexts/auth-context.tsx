'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { UserDTO } from '@saas/shared'
import { authApi } from '@/lib/auth'

interface AuthContextType {
  user: UserDTO | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, mfaCode?: string) => Promise<{ requiresMfa?: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me()
      if (userData?.id) {
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      try {
        const userData = await authApi.me()
        if (userData?.id) {
          setUser(userData)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(
    async (
      email: string,
      password: string,
      mfaCode?: string
    ): Promise<{ requiresMfa?: boolean }> => {
      const result = await authApi.login({ email, password, mfaCode })

      if (result.requiresMfa) {
        return { requiresMfa: true }
      }

      if (result.user) {
        setUser(result.user)
      }

      return {}
    },
    []
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
