import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError } from '@/lib/api'

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

describe('api client essentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    if (typeof document !== 'undefined') {
      document.cookie = 'XSRF-TOKEN=test-xsrf'
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('GET sends expected defaults and returns response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    })

    const result = await api.get('/api/v1/users')

    expect(result).toEqual({ data: { ok: true } })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/users',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    )
  })

  it('POST includes XSRF header and body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { created: true } }),
    })

    await api.post('/api/v1/auth/login', { email: 'a@b.com', password: 'password123' })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-XSRF-TOKEN': 'test-xsrf',
        }),
        body: JSON.stringify({ email: 'a@b.com', password: 'password123' }),
      })
    )
  })

  it('throws ApiError and preserves validation payload on non-2xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'ValidationError',
        message: 'Invalid data',
        errors: [{ field: 'email', message: 'Invalid email', rule: 'email' }],
      }),
    })

    await expect(api.post('/api/v1/auth/register', {})).rejects.toMatchObject({
      statusCode: 422,
      error: 'ValidationError',
      errors: [{ field: 'email', message: 'Invalid email', rule: 'email' }],
    } satisfies Partial<ApiError>)
  })

  it('DELETE calls the target URL with expected method', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'deleted' }),
    })

    await api.delete('/api/v1/users/1')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3333/api/v1/users/1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
