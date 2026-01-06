/**
 * API client for communicating with the backend
 */

/**
 * Get API URL with safe fallback for development only.
 * Throws in production if NEXT_PUBLIC_API_URL is not set.
 */
function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Configuration Error: NEXT_PUBLIC_API_URL is required in production. ' +
        'Set this environment variable before deploying.'
      )
    }
    // Safe fallback for development only
    return 'http://localhost:3333'
  }

  return url
}

const API_BASE_URL = getApiUrl()

// Export for use in other modules (e.g., auth.ts for OAuth URLs)
export { API_BASE_URL }

function getXsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return match ? match[1] : null
}

async function ensureXsrfToken(): Promise<string | null> {
  const existing = getXsrfToken()
  if (existing || typeof window === 'undefined') {
    return existing
  }

  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    })
  } catch {
    // Ignore: token cookie may still be set even on 401.
  }

  return getXsrfToken()
}

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
        'Accept': 'application/json',
      },
      credentials: 'include',
    })

    return handleResponse<T>(response)
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const xsrfToken = await ensureXsrfToken()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
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
    const xsrfToken = await ensureXsrfToken()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
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
    const xsrfToken = await ensureXsrfToken()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
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
  DiscountCodeDTO,
  CouponDTO,
  ValidateDiscountCodeResponse,
  RedeemCouponResponse,
  BalanceDTO,
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
    discountCode?: string
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

  /**
   * Validate a discount code
   */
  async validateDiscountCode(code: string, priceId: number): Promise<ValidateDiscountCodeResponse> {
    const response = await api.post<ValidateDiscountCodeResponse>('/api/v1/billing/validate-discount-code', { code, priceId })
    if (!response.data) {
      throw new Error('Failed to validate discount code')
    }
    return response.data
  },

  /**
   * Redeem a coupon
   */
  async redeemCoupon(code: string, teamId?: number): Promise<RedeemCouponResponse> {
    const response = await api.post<RedeemCouponResponse>('/api/v1/billing/redeem-coupon', { code, teamId })
    if (!response.data) {
      throw new Error('Failed to redeem coupon')
    }
    return response.data
  },

  /**
   * Get current balance
   */
  async getBalance(teamId?: number): Promise<BalanceDTO> {
    const endpoint = teamId ? `/api/v1/billing/balance?teamId=${teamId}` : '/api/v1/billing/balance'
    const response = await api.get<BalanceDTO>(endpoint)
    if (!response.data) {
      throw new Error('Failed to get balance')
    }
    return response.data
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
    level: number
    features?: Record<string, unknown>
    maxTeamMembers?: number
    priceMonthly?: number
    yearlyDiscountPercent?: number
    isActive?: boolean
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
      level?: number
      features?: Record<string, unknown> | null
      maxTeamMembers?: number | null
      priceMonthly?: number | null
      yearlyDiscountPercent?: number | null
      isActive?: boolean
    }
  ): Promise<SubscriptionTierDTO> {
    const response = await api.put<SubscriptionTierDTO>(`/api/v1/admin/tiers/${id}`, data)
    if (!response.data) {
      throw new Error('Failed to update tier')
    }
    return response.data
  },

  /**
   * Delete a tier
   */
  async deleteTier(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/tiers/${id}`)
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

/**
 * Admin API for managing discount codes
 */
export const adminDiscountCodesApi = {
  async list(): Promise<DiscountCodeDTO[]> {
    const response = await api.get<DiscountCodeDTO[]>('/api/v1/admin/discount-codes')
    return response.data || []
  },

  async get(id: number): Promise<DiscountCodeDTO> {
    const response = await api.get<DiscountCodeDTO>(`/api/v1/admin/discount-codes/${id}`)
    if (!response.data) throw new Error('Failed to get discount code')
    return response.data
  },

  async create(data: {
    code: string
    description?: string
    discountType: 'percent' | 'fixed'
    discountValue: number
    currency?: string
    minAmount?: number
    maxUses?: number
    maxUsesPerUser?: number
    expiresAt?: string
    isActive?: boolean
  }): Promise<DiscountCodeDTO> {
    const response = await api.post<DiscountCodeDTO>('/api/v1/admin/discount-codes', data)
    if (!response.data) throw new Error('Failed to create discount code')
    return response.data
  },

  async update(id: number, data: Partial<{
    code: string
    description: string | null
    discountType: 'percent' | 'fixed'
    discountValue: number
    currency: string | null
    minAmount: number | null
    maxUses: number | null
    maxUsesPerUser: number | null
    expiresAt: string | null
    isActive: boolean
  }>): Promise<DiscountCodeDTO> {
    const response = await api.put<DiscountCodeDTO>(`/api/v1/admin/discount-codes/${id}`, data)
    if (!response.data) throw new Error('Failed to update discount code')
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/discount-codes/${id}`)
  },
}

/**
 * Admin API for managing coupons
 */
export const adminCouponsApi = {
  async list(): Promise<CouponDTO[]> {
    const response = await api.get<CouponDTO[]>('/api/v1/admin/coupons')
    return response.data || []
  },

  async get(id: number): Promise<CouponDTO> {
    const response = await api.get<CouponDTO>(`/api/v1/admin/coupons/${id}`)
    if (!response.data) throw new Error('Failed to get coupon')
    return response.data
  },

  async create(data: {
    code: string
    description?: string
    creditAmount: number
    currency?: string
    expiresAt?: string
    isActive?: boolean
  }): Promise<CouponDTO> {
    const response = await api.post<CouponDTO>('/api/v1/admin/coupons', data)
    if (!response.data) throw new Error('Failed to create coupon')
    return response.data
  },

  async update(id: number, data: Partial<{
    code: string
    description: string | null
    creditAmount: number
    currency: string
    expiresAt: string | null
    isActive: boolean
  }>): Promise<CouponDTO> {
    const response = await api.put<CouponDTO>(`/api/v1/admin/coupons/${id}`, data)
    if (!response.data) throw new Error('Failed to update coupon')
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/coupons/${id}`)
  },
}
