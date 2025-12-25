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

// Import types for billing API
import type {
  BillingTierDTO,
  CheckoutSessionDTO,
  CustomerPortalDTO,
  BillingSubscriptionDTO,
  SubscriptionTierDTO,
  PriceDTO,
} from '@saas/shared'

/**
 * Billing API client
 */
export const billingApi = {
  /**
   * Get all billing tiers with prices (public)
   */
  async getTiers(): Promise<BillingTierDTO[]> {
    const response = await api.get<BillingTierDTO[]>('/api/v1/billing/tiers')
    return response.data || []
  },

  /**
   * Create a checkout session
   */
  async createCheckout(params: {
    priceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<CheckoutSessionDTO> {
    const response = await api.post<CheckoutSessionDTO>('/api/v1/billing/checkout', params)
    if (!response.data) {
      throw new Error('Failed to create checkout session')
    }
    return response.data
  },

  /**
   * Create a customer portal session
   */
  async createPortal(returnUrl: string): Promise<CustomerPortalDTO> {
    const response = await api.post<CustomerPortalDTO>('/api/v1/billing/portal', { returnUrl })
    if (!response.data) {
      throw new Error('Failed to create portal session')
    }
    return response.data
  },

  /**
   * Get current subscription status
   */
  async getSubscription(): Promise<BillingSubscriptionDTO> {
    const response = await api.get<BillingSubscriptionDTO>('/api/v1/billing/subscription')
    if (!response.data) {
      throw new Error('Failed to get subscription')
    }
    return response.data
  },

  /**
   * Cancel current subscription
   */
  async cancelSubscription(): Promise<void> {
    await api.post('/api/v1/billing/cancel')
  },
}

/**
 * Admin API for managing tiers and prices
 */
export const adminBillingApi = {
  /**
   * List all subscription tiers
   */
  async listTiers(): Promise<SubscriptionTierDTO[]> {
    const response = await api.get<SubscriptionTierDTO[]>('/api/v1/admin/tiers')
    return response.data || []
  },

  /**
   * Create a new tier
   */
  async createTier(data: {
    name: string
    slug: string
    description?: string
    level: number
    features?: Record<string, unknown>
    maxTeamMembers?: number
  }): Promise<SubscriptionTierDTO> {
    const response = await api.post<SubscriptionTierDTO>('/api/v1/admin/tiers', data)
    if (!response.data) {
      throw new Error('Failed to create tier')
    }
    return response.data
  },

  /**
   * Update a tier
   */
  async updateTier(
    id: number,
    data: {
      name?: string
      description?: string
      features?: Record<string, unknown>
      maxTeamMembers?: number
    }
  ): Promise<SubscriptionTierDTO> {
    const response = await api.put<SubscriptionTierDTO>(`/api/v1/admin/tiers/${id}`, data)
    if (!response.data) {
      throw new Error('Failed to update tier')
    }
    return response.data
  },

  /**
   * List all prices
   */
  async listPrices(): Promise<PriceDTO[]> {
    const response = await api.get<PriceDTO[]>('/api/v1/admin/prices')
    return response.data || []
  },

  /**
   * Create a new price
   */
  async createPrice(data: {
    productId: number
    providerPriceId: string
    interval: 'month' | 'year'
    currency: string
    unitAmount: number
    taxBehavior?: 'inclusive' | 'exclusive'
    isActive?: boolean
  }): Promise<PriceDTO> {
    const response = await api.post<PriceDTO>('/api/v1/admin/prices', data)
    if (!response.data) {
      throw new Error('Failed to create price')
    }
    return response.data
  },

  /**
   * Update a price
   */
  async updatePrice(
    id: number,
    data: {
      isActive?: boolean
    }
  ): Promise<PriceDTO> {
    const response = await api.put<PriceDTO>(`/api/v1/admin/prices/${id}`, data)
    if (!response.data) {
      throw new Error('Failed to update price')
    }
    return response.data
  },
}
