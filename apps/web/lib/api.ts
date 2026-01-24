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
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Configuration Error: NEXT_PUBLIC_API_URL is required in production. " +
          "Set this environment variable before deploying.",
      )
    }
    // Safe fallback for development only
    return "http://localhost:3333"
  }

  return url
}

const API_BASE_URL = getApiUrl()

// Export for use in other modules (e.g., auth.ts for OAuth URLs)
export { API_BASE_URL }

function getXsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null
  }
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return match ? match[1] : null
}

function getTenantId(): string | null {
  if (typeof document === "undefined") {
    return null
  }
  const match = document.cookie.match(/(?:^|; )tenant_id=([^;]+)/)
  return match ? match[1] : null
}

/**
 * Set the current tenant ID in a cookie
 */
export function setTenantId(tenantId: number | string | null): void {
  if (typeof document === "undefined") {
    return
  }
  if (tenantId === null) {
    document.cookie = "tenant_id=; path=/; max-age=0"
  } else {
    // Cookie expires in 30 days
    document.cookie = `tenant_id=${tenantId}; path=/; max-age=${30 * 24 * 60 * 60}`
  }
}

/**
 * Get the current tenant ID from cookie (exported for external use)
 */
export function getCurrentTenantId(): number | null {
  const id = getTenantId()
  return id ? parseInt(id, 10) : null
}

async function ensureXsrfToken(): Promise<string | null> {
  const existing = getXsrfToken()
  if (existing || typeof window === "undefined") {
    return existing
  }

  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    })
  } catch {
    // Ignore: token cookie may still be set even on 401.
  }

  return getXsrfToken()
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{ field: string; message: string; rule: string }>;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    public errors?: Array<{ field: string; message: string; rule: string }>,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || "UnknownError",
      data.message || "An error occurred",
      data.errors,
    )
  }

  return data
}

export const api = {
  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const tenantId = getTenantId()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
      credentials: "include",
    })

    return handleResponse<T>(response)
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const xsrfToken = await ensureXsrfToken()
    const tenantId = getTenantId()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const xsrfToken = await ensureXsrfToken()
    const tenantId = getTenantId()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const xsrfToken = await ensureXsrfToken()
    const tenantId = getTenantId()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
      credentials: "include",
    })

    return handleResponse<T>(response)
  },
}

// Import types for API
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
  TenantDTO,
  TenantWithMembersDTO,
  TenantInvitationDTO,
  InvitationDetailsDTO,
  AcceptInvitationResponseDTO,
  TenantRole,
  InvitationRole,
} from "@saas/shared"

/**
 * Tenants API client
 */
export const tenantsApi = {
  /**
   * Get all tenants for the current user
   */
  async list(): Promise<TenantDTO[]> {
    const response = await api.get<TenantDTO[]>("/api/v1/tenants")
    return response.data || []
  },

  /**
   * Create a new tenant
   */
  async create(data: { name: string }): Promise<TenantDTO> {
    const response = await api.post<TenantDTO>("/api/v1/tenants", data)
    if (!response.data) {
      throw new Error("Failed to create tenant")
    }
    return response.data
  },

  /**
   * Get a tenant by ID with members
   */
  async get(id: number): Promise<TenantWithMembersDTO> {
    const response = await api.get<TenantWithMembersDTO>(`/api/v1/tenants/${id}`)
    if (!response.data) {
      throw new Error("Failed to get tenant")
    }
    return response.data
  },

  /**
   * Update a tenant
   */
  async update(id: number, data: { name?: string }): Promise<TenantDTO> {
    const response = await api.put<TenantDTO>(`/api/v1/tenants/${id}`, data)
    if (!response.data) {
      throw new Error("Failed to update tenant")
    }
    return response.data
  },

  /**
   * Delete a tenant
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/tenants/${id}`)
  },

  /**
   * Switch current tenant
   */
  async switch(tenantId: number): Promise<void> {
    await api.post(`/api/v1/tenants/${tenantId}/switch`)
    setTenantId(tenantId)
  },

  /**
   * Add a member to a tenant
   */
  async addMember(
    tenantId: number,
    data: { email: string; role?: TenantRole },
  ): Promise<void> {
    await api.post(`/api/v1/tenants/${tenantId}/members`, data)
  },

  /**
   * Remove a member from a tenant
   */
  async removeMember(tenantId: number, userId: number): Promise<void> {
    await api.delete(`/api/v1/tenants/${tenantId}/members/${userId}`)
  },

  /**
   * Leave a tenant
   */
  async leave(tenantId: number): Promise<void> {
    await api.post(`/api/v1/tenants/${tenantId}/leave`)
  },

  /**
   * Get pending invitations for a tenant
   */
  async getInvitations(tenantId: number): Promise<TenantInvitationDTO[]> {
    const response = await api.get<TenantInvitationDTO[]>(
      `/api/v1/tenants/${tenantId}/invitations`,
    )
    return response.data || []
  },

  /**
   * Send an invitation
   */
  async sendInvitation(
    tenantId: number,
    data: { email: string; role?: InvitationRole },
  ): Promise<{ invitationLink: string }> {
    const response = await api.post<{ invitationLink: string }>(
      `/api/v1/tenants/${tenantId}/invitations`,
      data,
    )
    if (!response.data) {
      throw new Error("Failed to send invitation")
    }
    return response.data
  },

  /**
   * Cancel an invitation
   */
  async cancelInvitation(tenantId: number, invitationId: number): Promise<void> {
    await api.delete(`/api/v1/tenants/${tenantId}/invitations/${invitationId}`)
  },
}

/**
 * Invitations API client (public routes)
 */
export const invitationsApi = {
  /**
   * Get invitation details by token
   */
  async getByToken(token: string): Promise<InvitationDetailsDTO> {
    const response = await api.get<InvitationDetailsDTO>(
      `/api/v1/invitations/${token}`,
    )
    if (!response.data) {
      throw new Error("Failed to get invitation")
    }
    return response.data
  },

  /**
   * Accept an invitation
   */
  async accept(token: string): Promise<AcceptInvitationResponseDTO> {
    const response = await api.post<AcceptInvitationResponseDTO>(
      `/api/v1/invitations/${token}/accept`,
    )
    if (!response.data) {
      throw new Error("Failed to accept invitation")
    }
    return response.data
  },

  /**
   * Decline an invitation
   */
  async decline(token: string): Promise<void> {
    await api.post(`/api/v1/invitations/${token}/decline`)
  },
}

/**
 * Billing API client
 */
export const billingApi = {
  /**
   * Get all billing tiers with prices (public)
   */
  async getTiers(): Promise<BillingTierDTO[]> {
    const response = await api.get<BillingTierDTO[]>("/api/v1/billing/tiers")
    return response.data || []
  },

  /**
   * Create a checkout session
   */
  async createCheckout(params: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    discountCode?: string;
  }): Promise<CheckoutSessionDTO> {
    const response = await api.post<CheckoutSessionDTO>(
      "/api/v1/billing/checkout",
      params,
    )
    if (!response.data) {
      throw new Error("Failed to create checkout session")
    }
    return response.data
  },

  /**
   * Create a customer portal session
   */
  async createPortal(returnUrl: string): Promise<CustomerPortalDTO> {
    const response = await api.post<CustomerPortalDTO>(
      "/api/v1/billing/portal",
      { returnUrl },
    )
    if (!response.data) {
      throw new Error("Failed to create portal session")
    }
    return response.data
  },

  /**
   * Get current subscription status
   */
  async getSubscription(): Promise<BillingSubscriptionDTO> {
    const response = await api.get<BillingSubscriptionDTO>(
      "/api/v1/billing/subscription",
    )
    if (!response.data) {
      throw new Error("Failed to get subscription")
    }
    return response.data
  },

  /**
   * Cancel current subscription
   */
  async cancelSubscription(): Promise<void> {
    await api.post("/api/v1/billing/cancel")
  },

  /**
   * Validate a discount code
   */
  async validateDiscountCode(
    code: string,
    priceId: number,
  ): Promise<ValidateDiscountCodeResponse> {
    const response = await api.post<ValidateDiscountCodeResponse>(
      "/api/v1/billing/validate-discount-code",
      { code, priceId },
    )
    if (!response.data) {
      throw new Error("Failed to validate discount code")
    }
    return response.data
  },

  /**
   * Redeem a coupon
   */
  async redeemCoupon(
    code: string,
    tenantId?: number,
  ): Promise<RedeemCouponResponse> {
    const response = await api.post<RedeemCouponResponse>(
      "/api/v1/billing/redeem-coupon",
      { code, tenantId },
    )
    if (!response.data) {
      throw new Error("Failed to redeem coupon")
    }
    return response.data
  },

  /**
   * Get current balance
   */
  async getBalance(tenantId?: number): Promise<BalanceDTO> {
    const endpoint = tenantId
      ? `/api/v1/billing/balance?tenantId=${tenantId}`
      : "/api/v1/billing/balance"
    const response = await api.get<BalanceDTO>(endpoint)
    if (!response.data) {
      throw new Error("Failed to get balance")
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
    const response = await api.get<SubscriptionTierDTO[]>(
      "/api/v1/admin/tiers",
    )
    return response.data || []
  },

  /**
   * Create a new tier
   */
  async createTier(data: {
    name: string;
    slug: string;
    level: number;
    features?: Record<string, unknown>;
    maxTeamMembers?: number;
    priceMonthly?: number;
    yearlyDiscountPercent?: number;
    isActive?: boolean;
  }): Promise<SubscriptionTierDTO> {
    const response = await api.post<SubscriptionTierDTO>(
      "/api/v1/admin/tiers",
      data,
    )
    if (!response.data) {
      throw new Error("Failed to create tier")
    }
    return response.data
  },

  /**
   * Update a tier
   */
  async updateTier(
    id: number,
    data: {
      name?: string;
      level?: number;
      features?: Record<string, unknown> | null;
      maxTeamMembers?: number | null;
      priceMonthly?: number | null;
      yearlyDiscountPercent?: number | null;
      isActive?: boolean;
    },
  ): Promise<SubscriptionTierDTO> {
    const response = await api.put<SubscriptionTierDTO>(
      `/api/v1/admin/tiers/${id}`,
      data,
    )
    if (!response.data) {
      throw new Error("Failed to update tier")
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
    const response = await api.get<PriceDTO[]>("/api/v1/admin/prices")
    return response.data || []
  },

  /**
   * Create a new price
   */
  async createPrice(data: {
    productId: number;
    providerPriceId: string;
    interval: "month" | "year";
    currency: string;
    unitAmount: number;
    taxBehavior?: "inclusive" | "exclusive";
    isActive?: boolean;
  }): Promise<PriceDTO> {
    const response = await api.post<PriceDTO>("/api/v1/admin/prices", data)
    if (!response.data) {
      throw new Error("Failed to create price")
    }
    return response.data
  },

  /**
   * Update a price
   */
  async updatePrice(
    id: number,
    data: {
      isActive?: boolean;
    },
  ): Promise<PriceDTO> {
    const response = await api.put<PriceDTO>(
      `/api/v1/admin/prices/${id}`,
      data,
    )
    if (!response.data) {
      throw new Error("Failed to update price")
    }
    return response.data
  },

  /**
   * Delete a price
   */
  async deletePrice(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/prices/${id}`)
  },

  /**
   * List all products (Stripe products linked to tiers)
   */
  async listProducts(): Promise<StripeProductDTO[]> {
    const response = await api.get<StripeProductDTO[]>(
      "/api/v1/admin/products",
    )
    return response.data || []
  },

  /**
   * Create a product (link tier to Stripe product)
   */
  async createProduct(data: {
    tierId: number;
    provider: string;
    providerProductId: string;
  }): Promise<StripeProductDTO> {
    const response = await api.post<StripeProductDTO>(
      "/api/v1/admin/products",
      data,
    )
    if (!response.data) {
      throw new Error("Failed to create product")
    }
    return response.data
  },

  /**
   * Update a product
   */
  async updateProduct(
    id: number,
    data: {
      providerProductId?: string;
    },
  ): Promise<StripeProductDTO> {
    const response = await api.put<StripeProductDTO>(
      `/api/v1/admin/products/${id}`,
      data,
    )
    if (!response.data) {
      throw new Error("Failed to update product")
    }
    return response.data
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/products/${id}`)
  },
}

/**
 * Stripe Product DTO for admin management
 */
export interface StripeProductDTO {
  id: number;
  tierId: number;
  provider: string;
  providerProductId: string;
  tier?: {
    id: number;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Stripe Price DTO for admin management (extended with provider info)
 */
export interface StripePriceDTO {
  id: number;
  productId: number;
  provider: string;
  providerPriceId: string;
  interval: "month" | "year";
  currency: string;
  unitAmount: number;
  taxBehavior: "inclusive" | "exclusive";
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Admin API for managing tenants
 */
export const adminTenantsApi = {
  /**
   * List all tenants with admin details
   */
  async list(): Promise<AdminTenantDTO[]> {
    const response = await api.get<AdminTenantDTO[]>("/api/v1/admin/tenants")
    return response.data || []
  },

  /**
   * Update a tenant's subscription tier
   */
  async updateTier(
    id: number,
    data: { subscriptionTier: string },
  ): Promise<void> {
    await api.put(`/api/v1/admin/tenants/${id}/tier`, data)
  },
}

/** @deprecated Use adminTenantsApi instead */
export const adminTeamsApi = adminTenantsApi

// Import admin tenant type
import type { AdminTenantDTO } from "@saas/shared"

/**
 * Admin API for managing discount codes
 */
export const adminDiscountCodesApi = {
  async list(): Promise<DiscountCodeDTO[]> {
    const response = await api.get<DiscountCodeDTO[]>(
      "/api/v1/admin/discount-codes",
    )
    return response.data || []
  },

  async get(id: number): Promise<DiscountCodeDTO> {
    const response = await api.get<DiscountCodeDTO>(
      `/api/v1/admin/discount-codes/${id}`,
    )
    if (!response.data) throw new Error("Failed to get discount code")
    return response.data
  },

  async create(data: {
    code: string;
    description?: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    currency?: string;
    minAmount?: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<DiscountCodeDTO> {
    const response = await api.post<DiscountCodeDTO>(
      "/api/v1/admin/discount-codes",
      data,
    )
    if (!response.data) throw new Error("Failed to create discount code")
    return response.data
  },

  async update(
    id: number,
    data: Partial<{
      code: string;
      description: string | null;
      discountType: "percent" | "fixed";
      discountValue: number;
      currency: string | null;
      minAmount: number | null;
      maxUses: number | null;
      maxUsesPerUser: number | null;
      expiresAt: string | null;
      isActive: boolean;
    }>,
  ): Promise<DiscountCodeDTO> {
    const response = await api.put<DiscountCodeDTO>(
      `/api/v1/admin/discount-codes/${id}`,
      data,
    )
    if (!response.data) throw new Error("Failed to update discount code")
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
    const response = await api.get<CouponDTO[]>("/api/v1/admin/coupons")
    return response.data || []
  },

  async get(id: number): Promise<CouponDTO> {
    const response = await api.get<CouponDTO>(`/api/v1/admin/coupons/${id}`)
    if (!response.data) throw new Error("Failed to get coupon")
    return response.data
  },

  async create(data: {
    code: string;
    description?: string;
    creditAmount: number;
    currency?: string;
    expiresAt?: string;
    isActive?: boolean;
  }): Promise<CouponDTO> {
    const response = await api.post<CouponDTO>("/api/v1/admin/coupons", data)
    if (!response.data) throw new Error("Failed to create coupon")
    return response.data
  },

  async update(
    id: number,
    data: Partial<{
      code: string;
      description: string | null;
      creditAmount: number;
      currency: string;
      expiresAt: string | null;
      isActive: boolean;
    }>,
  ): Promise<CouponDTO> {
    const response = await api.put<CouponDTO>(
      `/api/v1/admin/coupons/${id}`,
      data,
    )
    if (!response.data) throw new Error("Failed to update coupon")
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/admin/coupons/${id}`)
  },
}
