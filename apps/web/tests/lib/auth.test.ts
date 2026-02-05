import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authApi, mfaApi, oauthApi } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  API_BASE_URL: 'http://localhost:3333',
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public error: string,
      message: string
    ) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

describe('auth lib essentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login maps API user payload under user key', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 42,
        email: 'user@test.com',
        fullName: 'Test User',
        role: 'user',
        emailVerified: true,
        mfaEnabled: false,
        avatarUrl: null,
      },
    })

    const result = await authApi.login({ email: 'user@test.com', password: 'password123' })

    expect(result.user?.id).toBe(42)
    expect(result).not.toHaveProperty('id')
  })

  it('login returns requiresMfa when backend requests MFA', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { requiresMfa: true } })

    const result = await authApi.login({ email: 'user@test.com', password: 'password123' })

    expect(result).toEqual({ requiresMfa: true })
  })

  it('me returns null on 401 and rethrows other errors', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized', 'Not authenticated'))
      .mockRejectedValueOnce(new Error('Network error'))

    await expect(authApi.me()).resolves.toBeNull()
    await expect(authApi.me()).rejects.toThrow('Network error')
  })

  it('logout calls auth logout endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({})

    await authApi.logout()

    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout')
  })

  it('mfa setup delegates to API endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { secret: 'secret-key' } })

    await mfaApi.setup()

    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/mfa/setup')
  })

  it('oauth helpers build provider URLs', () => {
    expect(oauthApi.getRedirectUrl('google')).toBe(
      'http://localhost:3333/api/v1/auth/oauth/google/redirect'
    )
    expect(oauthApi.getLinkUrl('github')).toBe('http://localhost:3333/api/v1/auth/oauth/github/link')
  })
})
