/**
 * API client for communicating with the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

export interface ApiResponse<T> {
  data?: T
  message?: string
  error?: string
  errors?: Array<{ field: string; message: string; rule: string }>
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    public errors?: Array<{ field: string; message: string; rule: string }>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'UnknownError',
      data.message || 'An error occurred',
      data.errors
    )
  }

  return data
}

export const api = {
  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    return handleResponse<T>(response)
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    return handleResponse<T>(response)
  },
}
