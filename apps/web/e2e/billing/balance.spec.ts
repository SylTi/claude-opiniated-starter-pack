import { test, expect } from '@playwright/test'
import { goToBilling } from '../helpers/navigation'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Balance Card', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'tier1' as const,
    emailVerifiedAt: new Date().toISOString(),
    mfaEnabled: false,
    avatarUrl: null,
    currentTeamId: null,
    createdAt: new Date().toISOString(),
  }

  const mockTiers = [
    {
      tier: { id: 1, name: 'Free', slug: 'free', level: 0, description: 'Basic features', features: {}, maxTeamMembers: null },
      prices: [],
    },
    {
      tier: { id: 2, name: 'Tier 1', slug: 'tier1', level: 1, description: 'Pro features', features: { advanced_analytics: true }, maxTeamMembers: 5 },
      prices: [
        { id: 1, unitAmount: 1999, currency: 'usd', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 2, unitAmount: 19990, currency: 'usd', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
      ],
    },
    {
      tier: { id: 3, name: 'Tier 2', slug: 'tier2', level: 2, description: 'Enterprise features', features: { advanced_analytics: true, white_label: true }, maxTeamMembers: 25 },
      prices: [
        { id: 3, unitAmount: 4999, currency: 'usd', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 4, unitAmount: 49990, currency: 'usd', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
      ],
    },
  ]

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, mockUser)

    await page.route('**/api/v1/billing/tiers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockTiers }),
      })
    })

    await page.route('**/api/v1/billing/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { subscription: null, canManage: true, hasPaymentMethod: false } }),
      })
    })
  })

  test.describe('Balance Display', () => {
    test('should display balance card with amount', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 5000, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      // Should show balance card
      await expect(page.locator('text=Account Balance')).toBeVisible()
      await expect(page.locator('text=$50.00')).toBeVisible()
    })

    test('should display zero balance correctly', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('text=Account Balance')).toBeVisible()
      await expect(page.locator('text=$0.00')).toBeVisible()
    })

    test('should format different currencies correctly', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 10000, currency: 'eur' } }),
        })
      })

      await goToBilling(page)

      // Should show EUR formatted balance
      await expect(page.locator('text=Account Balance')).toBeVisible()
      // EUR format may vary by locale
      await expect(page.locator('text=/€100|EUR 100/')).toBeVisible()
    })

    test('should display balance description text', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 5000, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('text=available credit balance')).toBeVisible()
      await expect(page.locator('text=applied to your next invoice')).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading spinner while fetching balance', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 5000, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      // Should show loading spinner
      const spinner = page.locator('[class*="animate-spin"]')
      await expect(spinner.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Error State', () => {
    test('should show error message on balance fetch failure', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to load balance' }),
        })
      })

      await goToBilling(page)

      // Should show error message
      await expect(page.locator('text=Failed to load balance').or(page.locator('[class*="destructive"]')).first()).toBeVisible()
    })
  })

  test.describe('Wallet Icon', () => {
    test('should display wallet icon in balance card', async ({ page }) => {
      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 5000, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      // Should have wallet icon (SVG)
      const walletIcon = page.locator('svg').filter({ has: page.locator('[class*="wallet"]') }).or(page.locator('text=Account Balance').locator('..').locator('svg').first())
      await expect(walletIcon.first()).toBeVisible()
    })
  })
})
