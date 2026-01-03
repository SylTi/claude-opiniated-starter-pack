import { test, expect } from '@playwright/test'
import { goToBilling } from '../helpers/navigation'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Checkout Flow', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'free' as const,
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
        body: JSON.stringify({ data: { subscription: null, canManage: false, hasPaymentMethod: false } }),
      })
    })

    await page.route('**/api/v1/billing/balance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
      })
    })
  })

  test.describe('Subscribe Button Click', () => {
    test('should trigger checkout when clicking upgrade button', async ({ page }) => {
      let checkoutCalled = false
      let checkoutPayload: Record<string, unknown> | null = null

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutCalled = true
        const request = route.request()
        checkoutPayload = JSON.parse(request.postData() ?? '{}')

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutCalled).toBe(true)
      expect(checkoutPayload).not.toBeNull()
    })

    test('should send correct priceId in checkout request', async ({ page }) => {
      let checkoutPayload: { priceId?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.priceId).toBe('1') // Monthly price ID for Tier 1
    })

    test('should send yearly priceId when yearly is selected', async ({ page }) => {
      let checkoutPayload: { priceId?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      // Switch to yearly
      await page.click('button:has-text("Yearly")')

      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.priceId).toBe('2') // Yearly price ID for Tier 1
    })

    test('should include successUrl in checkout request', async ({ page }) => {
      let checkoutPayload: { successUrl?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.successUrl).toContain('/billing/success')
    })

    test('should include cancelUrl in checkout request', async ({ page }) => {
      let checkoutPayload: { cancelUrl?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.cancelUrl).toContain('/billing')
    })
  })

  test.describe('Checkout With Discount', () => {
    test('should include discount code in checkout request when validated', async ({ page }) => {
      let checkoutPayload: { discountCode?: string } = {}

      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      // Enter discount code
      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      // First click validates
      await page.click('button:has-text("Upgrade to Tier 1")')

      // Wait for validation
      await expect(page.locator('text=Discount Applied')).toBeVisible()

      // Second click proceeds with checkout
      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.discountCode).toBe('SAVE20')
    })

    test('should not include discount code if not validated', async ({ page }) => {
      let checkoutPayload: { discountCode?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      // Click subscribe without entering discount
      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(checkoutPayload.discountCode).toBeUndefined()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading state on button while creating checkout', async ({ page }) => {
      await page.route('**/api/v1/billing/checkout', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Button should show loading
      await expect(page.getByRole('button', { name: 'Loading...' }).first()).toBeVisible()
    })

    test('should disable other upgrade buttons while loading', async ({ page }) => {
      await page.route('**/api/v1/billing/checkout', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      // Wait for page to load
      await expect(page.getByRole('button', { name: 'Upgrade to Tier 1' })).toBeVisible()

      await page.click('button:has-text("Upgrade to Tier 1")')

      // When checkoutLoading is true, all buttons show "Loading..." text and are disabled
      // There should be multiple Loading buttons (one for each paid tier)
      const loadingButtons = page.getByRole('button', { name: 'Loading...' })
      await expect(loadingButtons.first()).toBeVisible()
      await expect(loadingButtons.first()).toBeDisabled()
      // Verify there are at least 2 loading buttons (Tier 1 and Tier 2)
      await expect(loadingButtons).toHaveCount(2)
    })
  })

  test.describe('Checkout Error Handling', () => {
    test('should show error message when checkout fails', async ({ page }) => {
      await page.route('**/api/v1/billing/checkout', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to create checkout session' }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Should show error
      await expect(page.locator('text=Failed to create checkout').or(page.locator('[class*="destructive"]')).first()).toBeVisible()
    })

    test('should re-enable button after error', async ({ page }) => {
      await page.route('**/api/v1/billing/checkout', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to create checkout session' }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Wait for error
      await expect(page.locator('text=Failed to create checkout').or(page.locator('[class*="destructive"]')).first()).toBeVisible()

      // Button should be re-enabled
      await expect(page.locator('button:has-text("Upgrade to Tier 1")')).toBeEnabled()
    })

    test('should handle payment method required error', async ({ page }) => {
      await page.route('**/api/v1/billing/checkout', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'BadRequest', message: 'No payment method on file' }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Should stay on page
      await expect(page).toHaveURL('/billing')
    })
  })

  test.describe('Different Tiers', () => {
    test('should checkout Tier 2 correctly', async ({ page }) => {
      let checkoutPayload: { priceId?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Upgrade to Tier 2")')

      expect(checkoutPayload.priceId).toBe('3') // Monthly price ID for Tier 2
    })

    test('should checkout yearly Tier 2 correctly', async ({ page }) => {
      let checkoutPayload: { priceId?: string } = {}

      await page.route('**/api/v1/billing/checkout', async (route) => {
        checkoutPayload = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { url: 'https://checkout.stripe.com/test-session' } }),
        })
      })

      await goToBilling(page)

      // Switch to yearly
      await page.click('button:has-text("Yearly")')

      await page.click('button:has-text("Upgrade to Tier 2")')

      expect(checkoutPayload.priceId).toBe('4') // Yearly price ID for Tier 2
    })
  })

  test.describe('Current Plan Cannot Checkout', () => {
    test('should disable upgrade button for current plan', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      // Wait for page to load
      await expect(page.getByText('Tier 1', { exact: true }).first()).toBeVisible()

      // Current plan button should show "Current Plan" and be disabled
      const currentPlanButton = page.getByRole('button', { name: 'Current Plan' })
      await expect(currentPlanButton).toBeDisabled()
    })
  })
})
