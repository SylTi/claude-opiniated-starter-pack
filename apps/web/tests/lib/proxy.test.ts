import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

type TestCookie = { name: string; value: string }

function createRequest(
  path: string,
  options?: {
    search?: string
    cookies?: TestCookie[]
  }
): NextRequest {
  const search = options?.search ?? ''
  const cookies = options?.cookies ?? []
  const url = `http://localhost:3000${path}${search}`

  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      getAll: () => cookies,
    },
  } as unknown as NextRequest
}

describe('proxy auth verification', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  it('redirects unauthenticated protected routes to login', async () => {
    const request = createRequest('/dashboard')

    const response = await proxy(request)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toContain('/login?returnTo=%2Fdashboard')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('verifies session through /auth/me and allows authenticated user route', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { role: 'user' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const request = createRequest('/dashboard', {
      cookies: [
        { name: 'adonis-session', value: 'session-id' },
        { name: '_ga', value: 'analytics' },
      ],
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'adonis-session=session-id',
        }),
      })
    )
  })

  it('redirects non-admin users away from admin routes', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { role: 'user' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const request = createRequest('/admin', {
      cookies: [{ name: 'adonis-session', value: 'session-id' }],
    })

    const response = await proxy(request)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toContain('/dashboard')
  })

  it('allows admin routes for admin users', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { role: 'admin' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const request = createRequest('/admin', {
      cookies: [{ name: 'adonis-session', value: 'session-id' }],
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('fails closed in production when API_URL origin is untrusted', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('API_URL', 'https://untrusted.example.com')

    const request = createRequest('/dashboard', {
      cookies: [{ name: 'adonis-session', value: 'session-id' }],
    })

    const response = await proxy(request)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toContain('/login?returnTo=%2Fdashboard')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
