'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { UserDTO } from '@saas/shared'
import { authApi } from '@/lib/auth'
import { setTenantId } from '@/lib/api'

interface AuthContextType {
  user: UserDTO | null
  isLoading: boolean
  isAuthenticated: boolean
  hasUserInfoCookie: boolean
  userRole: UserDTO['role'] | null
  login: (email: string, password: string, mfaCode?: string) => Promise<{ requiresMfa?: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
  children,
  initialHasUserInfoCookie = false,
  initialUserRole = null,
}: {
  children: ReactNode
  initialHasUserInfoCookie?: boolean
  initialUserRole?: UserDTO['role'] | null
}): React.ReactElement {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUserInfoCookie, setHasUserInfoCookie] = useState(initialHasUserInfoCookie)
  const [userRole, setUserRole] = useState<UserDTO['role'] | null>(initialUserRole)

  const clearUserInfoCookie = (): void => {
    if (typeof document === 'undefined') {
      return
    }
    document.cookie = 'user-info=; Max-Age=0; path=/'
    setHasUserInfoCookie(false)
    setUserRole(null)
  }

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me()
      if (userData?.id) {
        setUser(userData)
        setHasUserInfoCookie(true)
        setUserRole(userData.role)
        // Set tenant cookie for API requests
        if (userData.currentTenantId) {
          setTenantId(userData.currentTenantId)
        }
      } else {
        setUser(null)
        clearUserInfoCookie()
        setTenantId(null)
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
          setHasUserInfoCookie(true)
          setUserRole(userData.role)
          // Set tenant cookie for API requests
          if (userData.currentTenantId) {
            setTenantId(userData.currentTenantId)
          }
        } else {
          setUser(null)
          clearUserInfoCookie()
          setTenantId(null)
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
        setHasUserInfoCookie(true)
        setUserRole(result.user.role)
        // Set tenant cookie for API requests
        if (result.user.currentTenantId) {
          setTenantId(result.user.currentTenantId)
        }
      }

      return {}
    },
    []
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    clearUserInfoCookie()
    setTenantId(null)
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasUserInfoCookie,
    userRole,
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
