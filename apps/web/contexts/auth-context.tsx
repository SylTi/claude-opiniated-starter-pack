'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
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
  refreshUser: () => Promise<UserDTO | null>
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

  const clearUserInfoCookie = useCallback((): void => {
    if (typeof document === 'undefined') {
      return
    }
    document.cookie = 'user-info=; Max-Age=0; path=/'
    setHasUserInfoCookie(false)
    setUserRole(null)
  }, [])

  const applyUser = useCallback((userData: UserDTO): void => {
    setUser(userData)
    setHasUserInfoCookie(true)
    setUserRole(userData.role)

    // Set tenant cookie for API requests
    if (userData.currentTenantId) {
      setTenantId(userData.currentTenantId)
      return
    }
    setTenantId(null)
  }, [])

  const clearAuthState = useCallback((): void => {
    setUser(null)
    clearUserInfoCookie()
    setTenantId(null)
  }, [clearUserInfoCookie])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me()
      if (userData?.id) {
        applyUser(userData)
        return userData
      }
      clearAuthState()
      return null
    } catch {
      clearAuthState()
      return null
    }
  }, [applyUser, clearAuthState])

  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      try {
        await refreshUser()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [refreshUser])

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

      if (result.user?.id) {
        applyUser(result.user)
        return {}
      }

      const refreshedUser = await refreshUser()
      if (!refreshedUser) {
        throw new Error('Unable to establish authenticated session')
      }

      return {}
    },
    [applyUser, refreshUser]
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    clearAuthState()
  }, [clearAuthState])

  useEffect(() => {
    if (isLoading || !user) {
      return
    }

    const syncUser = (): void => {
      void refreshUser()
    }

    const handleFocus = (): void => {
      syncUser()
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        syncUser()
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncUser()
      }
    }, 60_000)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isLoading, refreshUser, user, user?.id, user?.currentTenantId])

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Without this, every AuthProvider render creates a new value object,
  // causing all useAuth() consumers to re-render even if values are unchanged.
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      hasUserInfoCookie,
      userRole,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, hasUserInfoCookie, userRole, login, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
