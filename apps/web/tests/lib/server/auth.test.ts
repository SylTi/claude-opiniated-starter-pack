import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyUserFromApi, type ServerUser } from '@/lib/server/auth'
import { cookies } from 'next/headers'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

describe('verifyUserFromApi', () => {
  const mockCookies = vi.mocked(cookies)
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null when no cookies are present', async () => {
    mockCookies.mockResolvedValue({
      getAll: () => [],
    } as never)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns null when no auth cookies are present (only non-auth cookies)', async () => {
    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: '_ga', value: 'analytics-token' },
        { name: 'preferences', value: 'dark-mode' },
      ],
    } as never)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards only auth cookies to the API (filters out non-auth cookies)', async () => {
    const mockUser: ServerUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      currentTenantId: 1,
    }

    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: 'session', value: 'session-token' },
        { name: 'user-info', value: 'user-info-token' },
        { name: '_ga', value: 'analytics-should-not-be-forwarded' },
        { name: 'preferences', value: 'should-not-be-forwarded' },
      ],
    } as never)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    } as Response)

    await verifyUserFromApi()

    // Only session and user-info should be forwarded
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'session=session-token; user-info=user-info-token',
        }),
      })
    )
  })

  it('forwards adonis-session cookie (the actual backend session cookie)', async () => {
    const mockUser: ServerUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      currentTenantId: 1,
    }

    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: 'adonis-session', value: 'adonis-session-value' },
        { name: 'user-info', value: 'user-info-token' },
        { name: '_ga', value: 'should-not-be-forwarded' },
      ],
    } as never)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    } as Response)

    await verifyUserFromApi()

    // adonis-session MUST be forwarded - this is the actual AdonisJS session cookie
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'adonis-session=adonis-session-value; user-info=user-info-token',
        }),
      })
    )
  })

  it('forwards cookies to the API and returns user data', async () => {
    const mockUser: ServerUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      currentTenantId: 1,
    }

    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: 'session', value: 'session-token' },
        { name: 'user-info', value: 'user-info-token' },
      ],
    } as never)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    } as Response)

    const result = await verifyUserFromApi()

    expect(result).toEqual(mockUser)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Cookie: 'session=session-token; user-info=user-info-token',
        }),
        cache: 'no-store',
      })
    )
  })

  it('returns null when API returns non-ok response', async () => {
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'session', value: 'invalid-token' }],
    } as never)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
  })

  it('returns null and logs error when fetch throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'session', value: 'token' }],
    } as never)

    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[verifyUserFromApi]'),
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('returns null and logs timeout when request times out', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'session', value: 'token' }],
    } as never)

    // Simulate an abort error (what AbortController throws on timeout)
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.mocked(global.fetch).mockRejectedValue(abortError)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Request timed out'),
      expect.any(Number),
      'ms'
    )

    consoleSpy.mockRestore()
  })

  it('uses fallback API URL in development', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_URL
    delete process.env.NEXT_PUBLIC_API_URL

    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'session', value: 'token' }],
    } as never)

    const mockUser: ServerUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      currentTenantId: 1,
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    } as Response)

    await verifyUserFromApi()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3333'),
      expect.anything()
    )

    process.env.NEXT_PUBLIC_API_URL = originalEnv
  })

  it('includes signal for abort controller in fetch options', async () => {
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'session', value: 'token' }],
    } as never)

    const mockUser: ServerUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      avatarUrl: null,
      currentTenantId: 1,
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    } as Response)

    await verifyUserFromApi()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  describe('runtime validation', () => {
    it('returns null for invalid API response shape', async () => {
      mockCookies.mockResolvedValue({
        getAll: () => [{ name: 'session', value: 'token' }],
      } as never)

      // Partial object missing required fields should fail validation
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 1, role: 'user' } }), // Missing email
      } as Response)

      const result = await verifyUserFromApi()

      expect(result).toBeNull()
    })

    it('returns null for invalid role in response', async () => {
      mockCookies.mockResolvedValue({
        getAll: () => [{ name: 'session', value: 'token' }],
      } as never)

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 1,
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'superadmin', // Invalid role
            emailVerified: true,
            mfaEnabled: false,
            avatarUrl: null,
            currentTenantId: 1,
          },
        }),
      } as Response)

      const result = await verifyUserFromApi()

      expect(result).toBeNull()
    })

    it('validates and returns full user object', async () => {
      mockCookies.mockResolvedValue({
        getAll: () => [{ name: 'session', value: 'token' }],
      } as never)

      const mockUser: ServerUser = {
        id: 1,
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: 'admin',
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
        currentTenantId: 1,
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUser }),
      } as Response)

      const result = await verifyUserFromApi()

      expect(result).toEqual(mockUser)
    })
  })
})
