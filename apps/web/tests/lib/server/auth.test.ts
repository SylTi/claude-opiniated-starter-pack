import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyUserFromApi } from '@/lib/server/auth'
import { cookies } from 'next/headers'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

describe('verifyUserFromApi essentials', () => {
  const mockCookies = vi.mocked(cookies)
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null when no auth cookie exists', async () => {
    mockCookies.mockResolvedValue({ getAll: () => [{ name: '_ga', value: 'analytics' }] } as never)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('forwards only auth cookies and returns user payload', async () => {
    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: 'adonis-session', value: 's1' },
        { name: 'user-info', value: 'u1' },
        { name: '_ga', value: 'ignored' },
      ],
    } as never)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 1, email: 'test@example.com', role: 'user' } }),
    } as Response)

    const result = await verifyUserFromApi()

    expect(result).toMatchObject({ id: 1, email: 'test@example.com' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'adonis-session=s1; user-info=u1',
        }),
      })
    )
  })

  it('returns null when API responds non-ok', async () => {
    mockCookies.mockResolvedValue({ getAll: () => [{ name: 'session', value: 'bad' }] } as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    mockCookies.mockResolvedValue({ getAll: () => [{ name: 'session', value: 'x' }] } as never)
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const result = await verifyUserFromApi()

    expect(result).toBeNull()
  })
})
