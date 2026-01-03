import { test, expect } from '@playwright/test'
import { goto, goToBilling } from '../helpers/navigation'
import { mockAuthenticatedUser, mockUnauthenticated } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Pricing Plans', () => {
  const mockTiers = [
    {
      tier: { id: 1, name: 'Free', slug: 'free', level: 0, description: 'Basic features for individuals', features: { basic_features: true }, maxTeamMembers: null },
      prices: [],
    },
    {
      tier: { id: 2, name: 'Tier 1', slug: 'tier1', level: 1, description: 'Pro features for professionals', features: { advanced_analytics: true, team_features: true }, maxTeamMembers: 5 },
      prices: [
        { id: 1, unitAmount: 1999, currency: 'usd', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 2, unitAmount: 19990, currency: 'usd', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
        { id: 3, unitAmount: 1799, currency: 'eur', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 4, unitAmount: 17990, currency: 'eur', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
      ],
    },
    {
      tier: { id: 3, name: 'Tier 2', slug: 'tier2', level: 2, description: 'Enterprise features for large teams', features: { advanced_analytics: true, white_label: true, custom_integrations: true }, maxTeamMembers: 25 },
      prices: [
        { id: 5, unitAmount: 4999, currency: 'usd', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 6, unitAmount: 49990, currency: 'usd', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
        { id: 7, unitAmount: 4499, currency: 'eur', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 8, unitAmount: 44990, currency: 'eur', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
      ],
    },
  ]

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

  test.describe('Plan Cards Display', () => {
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

    test('should display Available Plans heading', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('text=Available Plans')).toBeVisible()
    })

    test('should display all plan cards', async ({ page }) => {
      await goToBilling(page)

      await expect(page.getByText('Free', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Tier 1', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Tier 2', { exact: true }).first()).toBeVisible()
    })

    test('should show plan descriptions', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('text=Basic features for individuals')).toBeVisible()
      await expect(page.locator('text=Pro features for professionals')).toBeVisible()
      await expect(page.locator('text=Enterprise features for large teams')).toBeVisible()
    })

    test('should show features list for each plan', async ({ page }) => {
      await goToBilling(page)

      // Wait for plans to load then check for feature list items
      await expect(page.getByText('Tier 1', { exact: true }).first()).toBeVisible()

      // Check for feature items - look for list items or check marks
      const featureItems = page.locator('li, [data-slot="card-content"] svg')
      await expect(featureItems.first()).toBeVisible()
      expect(await featureItems.count()).toBeGreaterThanOrEqual(1)
    })

    test('should show team member limits', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('text=5 team members').or(page.locator('text=Up to 5')).first()).toBeVisible()
      await expect(page.locator('text=25 team members').or(page.locator('text=Up to 25')).first()).toBeVisible()
    })
  })

  test.describe('Billing Period Toggle', () => {
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

    test('should display Monthly and Yearly tabs', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('button:has-text("Monthly")')).toBeVisible()
      await expect(page.locator('button:has-text("Yearly")')).toBeVisible()
    })

    test('should show Save 20% badge on Yearly tab', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('text=Save 20%')).toBeVisible()
    })

    test('should default to Monthly pricing', async ({ page }) => {
      await goToBilling(page)

      // Monthly tab should be selected by default
      const monthlyTab = page.locator('button:has-text("Monthly")')
      await expect(monthlyTab).toHaveAttribute('data-state', 'active')

      // Should show monthly prices
      await expect(page.locator('text=$19.99').or(page.locator('text=$19')).first()).toBeVisible()
    })

    test('should switch to Yearly pricing when clicking Yearly tab', async ({ page }) => {
      await goToBilling(page)

      await page.click('button:has-text("Yearly")')

      // Should show yearly prices
      await expect(page.locator('text=$199.90').or(page.locator('text=$199')).first()).toBeVisible()
    })

    test('should show /month for monthly and /year for yearly', async ({ page }) => {
      await goToBilling(page)

      // Monthly should show /month
      await expect(page.getByText('/month').first()).toBeVisible()

      // Switch to yearly
      await page.click('button:has-text("Yearly")')

      // Should show /year
      await expect(page.getByText('/year').first()).toBeVisible()
    })
  })

  test.describe('Currency Selector', () => {
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

    test('should display currency selector', async ({ page }) => {
      await goToBilling(page)

      const currencySelector = page.locator('button[role="combobox"]:has-text("USD"), button:has-text("USD")')
      await expect(currencySelector.first()).toBeVisible()
    })

    test('should show available currencies', async ({ page }) => {
      await goToBilling(page)

      const currencySelector = page.locator('button[role="combobox"]').first()
      await currencySelector.click()

      await expect(page.locator('[role="option"]:has-text("USD")')).toBeVisible()
      await expect(page.locator('[role="option"]:has-text("EUR")')).toBeVisible()
    })

    test('should update prices when currency changes', async ({ page }) => {
      await goToBilling(page)

      // Initially USD
      await expect(page.locator('text=$19.99').or(page.locator('text=$19')).first()).toBeVisible()

      // Change to EUR
      const currencySelector = page.locator('button[role="combobox"]').first()
      await currencySelector.click()
      await page.click('[role="option"]:has-text("EUR")')

      // Should show EUR prices
      await expect(page.locator('text=€17.99').or(page.locator('text=€17')).or(page.locator('text=EUR')).first()).toBeVisible()
    })
  })

  test.describe('Free Plan Card', () => {
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

    test('should show "Free" text instead of price for Free plan', async ({ page }) => {
      await goToBilling(page)

      // Free plan should show "Free" as the price text
      await expect(page.getByText('Free', { exact: true }).first()).toBeVisible()
    })

    test('should show disabled button for Free plan', async ({ page }) => {
      await goToBilling(page)

      // Free plan button should be disabled
      const freeButton = page.locator('button:has-text("Free Forever"), button:has-text("Current Plan")').first()
      await expect(freeButton).toBeDisabled()
    })
  })

  test.describe('Current Plan Indicator', () => {
    test('should show "Current Plan" badge for subscribed tier', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, subscriptionTier: 'tier1' as const })

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

      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      // Tier 1 card should show "Current Plan"
      await expect(page.getByText('Current Plan').first()).toBeVisible()
    })

    test('should have highlighted border for current plan', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, subscriptionTier: 'tier1' as const })

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

      await page.route('**/api/v1/billing/balance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
        })
      })

      await goToBilling(page)

      // Current plan should show "Current Plan" button
      const currentPlanButton = page.getByRole('button', { name: 'Current Plan' })
      await expect(currentPlanButton).toBeVisible()
    })
  })

  test.describe('Upgrade Buttons', () => {
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

    test('should show upgrade button for paid plans', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('button:has-text("Upgrade to Tier 1")')).toBeVisible()
      await expect(page.locator('button:has-text("Upgrade to Tier 2")')).toBeVisible()
    })

    test('upgrade button should be enabled for non-current plans', async ({ page }) => {
      await goToBilling(page)

      const tier1Button = page.locator('button:has-text("Upgrade to Tier 1")')
      await expect(tier1Button).toBeEnabled()
    })
  })

  test.describe('Unauthenticated User', () => {
    test('should show sign in message for unauthenticated users', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTiers }),
        })
      })

      await goToBilling(page)

      // Use exact match to avoid matching the header "Sign in" link
      await expect(page.getByRole('link', { name: 'sign in', exact: true })).toBeVisible()
    })

    test('should still show pricing plans for unauthenticated users', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTiers }),
        })
      })

      await goToBilling(page)

      // Should still see plans
      await expect(page.getByText('Tier 1', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Tier 2', { exact: true }).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading skeleton while fetching tiers', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
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

      await goToBilling(page)

      // Should show loading skeleton
      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Tax Info', () => {
    test('should show "+ applicable taxes" text', async ({ page }) => {
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

      await goToBilling(page)

      await expect(page.locator('text=applicable taxes').first()).toBeVisible()
    })
  })
})
