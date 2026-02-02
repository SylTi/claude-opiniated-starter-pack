import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PluginLayout from '@/app/apps/[pluginId]/layout'
import { cookies, headers } from 'next/headers'
import { redirect, notFound, forbidden } from 'next/navigation'
import { verifyUserCookie } from '@/lib/cookie-signing'
import { verifyUserFromApi, type ServerUser } from '@/lib/server/auth'
import { loadClientPluginManifest } from '@saas/config/plugins/client'
import type { PluginManifest } from '@saas/plugins-core'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  forbidden: vi.fn(),
}))

vi.mock('@/lib/cookie-signing', () => ({
  verifyUserCookie: vi.fn(),
}))

vi.mock('@/lib/server/auth', () => ({
  verifyUserFromApi: vi.fn(),
}))

vi.mock('@saas/config/plugins/client', () => ({
  loadClientPluginManifest: vi.fn(),
}))

describe('Plugin Layout', () => {
  const mockCookies = vi.mocked(cookies)
  const mockHeaders = vi.mocked(headers)
  const mockRedirect = vi.mocked(redirect)
  const mockNotFound = vi.mocked(notFound)
  const mockForbidden = vi.mocked(forbidden)
  const mockVerify = vi.mocked(verifyUserCookie)
  const mockVerifyFromApi = vi.mocked(verifyUserFromApi)
  const mockLoadManifest = vi.mocked(loadClientPluginManifest)

  /**
   * Create a mock header store with optional header values.
   */
  const createMockHeaderStore = (headerValues: Record<string, string> = {}) => ({
    get: (name: string) => headerValues[name] ?? null,
  })

  const createManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    pluginId: 'test-plugin',
    packageName: '@plugins/test',
    version: '1.0.0',
    tier: 'A',
    requestedCapabilities: [],
    ...overrides,
  })

  const createServerUser = (overrides: Partial<ServerUser> = {}): ServerUser => ({
    id: 1,
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
    avatarUrl: null,
    currentTenantId: 1,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })
    mockNotFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
    mockForbidden.mockImplementation(() => {
      throw new Error('NEXT_FORBIDDEN')
    })
    // Default headers mock - empty headers (tests can override)
    mockHeaders.mockResolvedValue(createMockHeaderStore() as never)
  })

  describe('authentication', () => {
    it('redirects to login when no user cookie exists', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })

    it('redirects to login when cookie verification fails', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'invalid-cookie' }),
      } as never)
      mockVerify.mockResolvedValue(null)

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })
  })

  describe('plugin validation', () => {
    it('returns 404 when plugin does not exist', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'user' })
      mockLoadManifest.mockResolvedValue(null)

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'nonexistent' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('returns 404 for main-app tier plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'admin' })
      mockLoadManifest.mockResolvedValue(
        createManifest({
          tier: 'main-app',
          requestedCapabilities: [
            { capability: 'ui:design:global', reason: 'Theme' },
          ],
        })
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'main-app' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })
  })

  describe('authorization - server-side role verification', () => {
    it('redirects to login when server-side verification fails', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'user' })
      mockLoadManifest.mockResolvedValue(createManifest())
      mockVerifyFromApi.mockResolvedValue(null) // API returns no user

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Ftest-plugin'
      )
    })
  })

  describe('authorization - no access control', () => {
    it('allows any authenticated user when no accessControl is set', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'guest' })
      mockLoadManifest.mockResolvedValue(createManifest())
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'guest' }))

      const result = await PluginLayout({
        children: <div>Plugin Content</div>,
        params: Promise.resolve({ pluginId: 'test-plugin' }),
      })

      render(result)
      expect(screen.getByText('Plugin Content')).toBeInTheDocument()
    })
  })

  describe('authorization - requiredRole: admin', () => {
    const adminPlugin = createManifest({
      accessControl: { requiredRole: 'admin' },
    })

    it('allows admin users to access admin-only plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'admin' })
      mockLoadManifest.mockResolvedValue(adminPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'admin' }))

      const result = await PluginLayout({
        children: <div>Plugin Content</div>,
        params: Promise.resolve({ pluginId: 'test-plugin' }),
      })

      render(result)
      expect(screen.getByText('Plugin Content')).toBeInTheDocument()
    })

    it('returns 403 for regular users accessing admin-only plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'user' })
      mockLoadManifest.mockResolvedValue(adminPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'user' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
    })

    it('returns 403 for guest users accessing admin-only plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'guest' })
      mockLoadManifest.mockResolvedValue(adminPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'guest' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
    })
  })

  describe('authorization - requiredRole: user', () => {
    const userPlugin = createManifest({
      accessControl: { requiredRole: 'user' },
    })

    it('allows admin users to access user-level plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'admin' })
      mockLoadManifest.mockResolvedValue(userPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'admin' }))

      const result = await PluginLayout({
        children: <div>Plugin Content</div>,
        params: Promise.resolve({ pluginId: 'test-plugin' }),
      })

      render(result)
      expect(screen.getByText('Plugin Content')).toBeInTheDocument()
    })

    it('allows regular users to access user-level plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'user' })
      mockLoadManifest.mockResolvedValue(userPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'user' }))

      const result = await PluginLayout({
        children: <div>Plugin Content</div>,
        params: Promise.resolve({ pluginId: 'test-plugin' }),
      })

      render(result)
      expect(screen.getByText('Plugin Content')).toBeInTheDocument()
    })

    it('returns 403 for guest users accessing user-level plugins', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'guest' })
      mockLoadManifest.mockResolvedValue(userPlugin)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'guest' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
    })
  })

  describe('authorization - requiredRole: guest', () => {
    const guestPlugin = createManifest({
      accessControl: { requiredRole: 'guest' },
    })

    it('allows all authenticated users to access guest-level plugins', async () => {
      const roles: Array<'admin' | 'user' | 'guest'> = ['admin', 'user', 'guest']
      for (const role of roles) {
        vi.clearAllMocks()
        mockRedirect.mockImplementation(() => {
          throw new Error('NEXT_REDIRECT')
        })
        mockNotFound.mockImplementation(() => {
          throw new Error('NEXT_NOT_FOUND')
        })
        mockForbidden.mockImplementation(() => {
          throw new Error('NEXT_FORBIDDEN')
        })
        mockCookies.mockResolvedValue({
          get: () => ({ value: 'signed-cookie' }),
        } as never)
        mockVerify.mockResolvedValue({ role })
        mockLoadManifest.mockResolvedValue(guestPlugin)
        mockVerifyFromApi.mockResolvedValue(createServerUser({ role }))

        const result = await PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })

        const { unmount } = render(result)
        expect(screen.getByText('Plugin Content')).toBeInTheDocument()
        unmount()
      }
    })
  })

  describe('authorization - unknown roles', () => {
    it('returns 403 for unknown role values with accessControl', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'superadmin' }) // Invalid role
      mockLoadManifest.mockResolvedValue(
        createManifest({
          accessControl: { requiredRole: 'user' },
        })
      )
      // Type assertion needed: testing invalid role handling
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'superadmin' as 'admin' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown user role')
      )

      consoleSpy.mockRestore()
    })

    it('returns 403 for unknown role values even without accessControl', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      mockVerify.mockResolvedValue({ role: 'superadmin' }) // Invalid role
      mockLoadManifest.mockResolvedValue(createManifest()) // No accessControl
      // Type assertion needed: testing invalid role handling
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'superadmin' as 'admin' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown user role')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('authorization - stale role prevention', () => {
    it('uses role from API verification, not cookie claim', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      // Cookie says admin
      mockVerify.mockResolvedValue({ role: 'admin' })
      mockLoadManifest.mockResolvedValue(
        createManifest({
          accessControl: { requiredRole: 'admin' },
        })
      )
      // But API says user (role was downgraded)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'user' }))

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'test-plugin' }),
        })
      ).rejects.toThrow('NEXT_FORBIDDEN')

      expect(mockForbidden).toHaveBeenCalled()
    })

    it('allows access when API confirms admin role', async () => {
      mockCookies.mockResolvedValue({
        get: () => ({ value: 'signed-cookie' }),
      } as never)
      // Cookie might be stale
      mockVerify.mockResolvedValue({ role: 'user' })
      mockLoadManifest.mockResolvedValue(
        createManifest({
          accessControl: { requiredRole: 'admin' },
        })
      )
      // But API confirms admin (role was upgraded)
      mockVerifyFromApi.mockResolvedValue(createServerUser({ role: 'admin' }))

      const result = await PluginLayout({
        children: <div>Plugin Content</div>,
        params: Promise.resolve({ pluginId: 'test-plugin' }),
      })

      render(result)
      expect(screen.getByText('Plugin Content')).toBeInTheDocument()
    })
  })

  describe('callback URL preservation', () => {
    it('uses fallback URL when no headers are available', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(createMockHeaderStore() as never)

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })

    it('extracts callback URL from x-url header', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-url': 'http://localhost:3000/apps/notes/123/edit',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes%2F123%2Fedit'
      )
    })

    it('extracts callback URL from x-invoke-path header', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-invoke-path': '/apps/notes/documents/456',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes%2Fdocuments%2F456'
      )
    })

    it('preserves query string in path-only headers', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-invoke-path': '/apps/notes?tab=general&view=list',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      // Query string should be preserved
      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes%3Ftab%3Dgeneral%26view%3Dlist'
      )
    })

    it('extracts callback URL from referer header', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          referer: 'http://localhost:3000/apps/notes/settings?tab=general',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes%2Fsettings%3Ftab%3Dgeneral'
      )
    })

    it('ignores headers that do not match expected plugin path', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-url': 'http://localhost:3000/dashboard', // Does not start with /apps/notes
          referer: 'http://localhost:3000/profile',    // Also doesn't match
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      // Should use fallback since no headers match the expected prefix
      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })

    it('rejects similar plugin paths to prevent cross-plugin redirect (SECURITY)', async () => {
      // SECURITY: /apps/notes-malicious should NOT match pluginId=notes
      // This prevents an attacker from crafting a header that redirects to a different app
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-url': 'http://localhost:3000/apps/notes-malicious/steal-data',
          'x-invoke-path': '/apps/notebook',
          referer: 'http://localhost:3000/apps/notes2',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      // Should use fallback, NOT any of the similar-but-different paths
      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })

    it('accepts exact plugin path match', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-url': 'http://localhost:3000/apps/notes', // Exact match, no trailing slash
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes'
      )
    })

    it('prioritizes x-url over referer header', async () => {
      mockCookies.mockResolvedValue({
        get: () => undefined,
      } as never)
      mockHeaders.mockResolvedValue(
        createMockHeaderStore({
          'x-url': 'http://localhost:3000/apps/notes/from-x-url',
          referer: 'http://localhost:3000/apps/notes/from-referer',
        }) as never
      )

      await expect(
        PluginLayout({
          children: <div>Plugin Content</div>,
          params: Promise.resolve({ pluginId: 'notes' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT')

      // Should use x-url (higher priority)
      expect(mockRedirect).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fapps%2Fnotes%2Ffrom-x-url'
      )
    })
  })
})
