/**
 * Notes Plugin - API Client
 *
 * Self-contained API client for the notes plugin.
 * Uses inline helpers instead of importing from apps/web/lib/api.
 */

import type { NoteDTO } from '../types'

type ApiResponse<T> = {
  data?: T
  message?: string
  error?: string
}

export type PluginStatusDTO = {
  pluginId: string
  enabled: boolean
  version: string
  installedAt?: string
  config?: Record<string, unknown>
}

function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL
  if (configured && configured.trim().length > 0) {
    return configured.trim()
  }
  if (process.env.NODE_ENV === 'production') {
    return ''
  }
  return 'http://localhost:3333'
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

function getTenantId(): string | null {
  return readCookie('tenant_id')
}

function getXsrfToken(): string | null {
  return readCookie('XSRF-TOKEN')
}

async function ensureXsrfToken(): Promise<string | null> {
  const existing = getXsrfToken()
  if (existing) return existing
  try {
    await fetch(`${getApiUrl()}/api/v1/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // Best-effort
  }
  return getXsrfToken()
}

async function requestData<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown
): Promise<T> {
  const tenantId = getTenantId()
  const xsrfToken = method === 'GET' ? null : await ensureXsrfToken()
  const response = await fetch(`${getApiUrl()}${endpoint}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload: unknown = response.status === 204
    ? {}
    : await response.json().catch(() => ({}))

  const parsed = (typeof payload === 'object' && payload !== null && !Array.isArray(payload))
    ? (payload as ApiResponse<T>)
    : {}

  if (!response.ok) {
    const message = typeof parsed.message === 'string' ? parsed.message : 'Request failed'
    throw new Error(message)
  }

  // 204 No Content — nothing to return (used by DELETE)
  if (response.status === 204) {
    return undefined as T
  }

  if (parsed.data === undefined) {
    throw new Error('Missing response data')
  }

  return parsed.data
}

export const notesApi = {
  // Plugin management
  getPluginStatus(): Promise<PluginStatusDTO> {
    return requestData<PluginStatusDTO>('GET', '/api/v1/plugins/notes/status')
  },

  enablePlugin(): Promise<{ pluginId: string; enabled: boolean; message: string }> {
    return requestData<{ pluginId: string; enabled: boolean; message: string }>(
      'POST',
      '/api/v1/plugins/notes/enable',
      {}
    )
  },

  disablePlugin(): Promise<void> {
    return requestData<void>('POST', '/api/v1/plugins/notes/disable', {})
  },

  // Notes CRUD
  list(): Promise<NoteDTO[]> {
    return requestData<NoteDTO[]>('GET', '/api/v1/apps/notes/notes')
  },

  get(id: number): Promise<NoteDTO> {
    return requestData<NoteDTO>('GET', `/api/v1/apps/notes/notes/${id}`)
  },

  create(data: { title: string; content?: string }): Promise<NoteDTO> {
    return requestData<NoteDTO>('POST', '/api/v1/apps/notes/notes', data)
  },

  update(id: number, data: { title?: string; content?: string }): Promise<NoteDTO> {
    return requestData<NoteDTO>('PUT', `/api/v1/apps/notes/notes/${id}`, data)
  },

  delete(id: number): Promise<void> {
    return requestData<void>('DELETE', `/api/v1/apps/notes/notes/${id}`)
  },
}

export type { NoteDTO }
