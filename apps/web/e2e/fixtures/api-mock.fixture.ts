import { Page, Route } from '@playwright/test'

const API_BASE = '/api/v1'

/**
 * Mock a successful API response
 */
export async function mockApiResponse<T>(
  page: Page,
  endpoint: string,
  response: T,
  options: MockOptions = {}
): Promise<void> {
  const { method = 'GET', status = 200, delay = 0 } = options
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`

  await page.route(`**${url}`, async (route: Route) => {
    if (route.request().method() === method) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ data: response }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mock an API error response
 */
export async function mockApiError(
  page: Page,
  endpoint: string,
  status: number,
  message: string,
  options: Omit<MockOptions, 'status'> = {}
): Promise<void> {
  const { method = 'GET', delay = 0 } = options
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`

  await page.route(`**${url}`, async (route: Route) => {
    if (route.request().method() === method) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: getErrorType(status),
          message,
        }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mock a validation error response
 */
export async function mockValidationError(
  page: Page,
  endpoint: string,
  errors: ValidationError[],
  options: Omit<MockOptions, 'status'> = {}
): Promise<void> {
  const { method = 'POST', delay = 0 } = options
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`

  await page.route(`**${url}`, async (route: Route) => {
    if (route.request().method() === method) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Validation failed',
          errors,
        }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mock network failure
 */
export async function mockNetworkError(
  page: Page,
  endpoint: string,
  options: Omit<MockOptions, 'status'> = {}
): Promise<void> {
  const { method = 'GET' } = options
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`

  await page.route(`**${url}`, async (route: Route) => {
    if (route.request().method() === method) {
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })
}

/**
 * Mock authentication endpoints for logged-in state
 */
export async function mockAuthenticatedUser(
  page: Page,
  userData: AuthenticatedUserData
): Promise<void> {
  // Add effectiveSubscriptionTier if not provided
  const fullUserData = {
    ...userData,
    effectiveSubscriptionTier: userData.effectiveSubscriptionTier || {
      slug: userData.subscriptionTier,
      name: userData.subscriptionTier.charAt(0).toUpperCase() + userData.subscriptionTier.slice(1),
    },
  }
  await page.route('**/api/v1/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: fullUserData }),
    })
  })
}

/**
 * Mock unauthenticated state
 */
export async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Not authenticated',
      }),
    })
  })
}

/**
 * Mock dashboard stats
 */
export async function mockDashboardStats(page: Page, stats: DashboardStats): Promise<void> {
  // Ensure required fields have defaults to prevent undefined errors
  const fullStats = {
    ...stats,
    recentActivity: stats.recentActivity || [],
    connectedOAuthAccounts: stats.connectedOAuthAccounts ?? 0,
    lastLoginAt: stats.lastLoginAt ?? null,
    subscriptionTier: stats.subscriptionTier || 'free',
  }
  await mockApiResponse(page, '/dashboard/stats', fullStats)
}

/**
 * Mock admin stats
 */
export async function mockAdminStats(page: Page, stats: AdminStats): Promise<void> {
  await mockApiResponse(page, '/admin/stats', stats)
}

/**
 * Mock billing data
 */
export async function mockBillingData(page: Page, data: BillingData): Promise<void> {
  await mockApiResponse(page, '/billing/balance', { balance: data.balance, currency: data.currency })
  if (data.subscription) {
    await mockApiResponse(page, '/billing/subscription', data.subscription)
  }
}

/**
 * Clear all route mocks
 */
export async function clearMocks(page: Page): Promise<void> {
  await page.unrouteAll()
}

// Helper to get error type from status
function getErrorType(status: number): string {
  switch (status) {
    case 400:
      return 'BadRequest'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'NotFound'
    case 409:
      return 'Conflict'
    case 422:
      return 'ValidationError'
    case 500:
      return 'InternalServerError'
    default:
      return 'Error'
  }
}

// Types

interface MockOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  status?: number
  delay?: number
}

interface ValidationError {
  field: string
  message: string
  rule?: string
}

interface AuthenticatedUserData {
  id: number
  email: string
  fullName: string | null
  role: 'user' | 'admin'
  subscriptionTier: 'free' | 'tier1' | 'tier2'
  emailVerifiedAt: string | null
  mfaEnabled: boolean
  avatarUrl: string | null
  currentTeamId: number | null
  createdAt: string
  effectiveSubscriptionTier?: {
    slug: string
    name: string
  }
  currentTeam?: {
    id: number
    name: string
    slug: string
    subscription?: {
      expiresAt: string
    }
  }
}

interface DashboardStats {
  accountAgeDays: number
  totalLogins: number
  lastLoginAt?: string | null
  emailVerified: boolean
  mfaEnabled: boolean
  subscriptionTier?: 'free' | 'tier1' | 'tier2'
  connectedOAuthAccounts?: number
  recentActivity?: Array<{
    method: string
    success: boolean
    ipAddress?: string | null
    createdAt: string
  }>
}

interface AdminStats {
  totalUsers: number
  newUsersThisMonth: number
  verifiedUsers: number
  verificationRate: number
  mfaUsers: number
  mfaAdoptionRate: number
  activeThisWeek: number
  usersByRole: Array<{ role: string; count: number }>
}

interface BillingData {
  balance: number
  currency: string
  subscription?: {
    plan: string
    status: 'active' | 'trialing' | 'past_due' | 'cancelled'
    currentPeriodEnd: string
  }
}
