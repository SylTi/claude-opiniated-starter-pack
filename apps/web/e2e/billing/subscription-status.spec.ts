import { test, expect } from '@playwright/test'
import { goToBilling } from '../helpers/navigation'
import { expectDialog } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Subscription Status', () => {
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

    await page.route('**/api/v1/billing/balance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
      })
    })
  })

  test.describe('Active Subscription', () => {
    test('should display subscription card with plan name', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      // Check for subscription card with plan name
      await expect(page.getByText('Active').first()).toBeVisible()
      await expect(page.getByText('Tier 1', { exact: true }).first()).toBeVisible()
    })

    test('should show green Active badge', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      // Should show Active badge with green styling
      const activeBadge = page.locator('span:has-text("Active")').filter({ hasText: /^Active$/ })
      await expect(activeBadge).toBeVisible()
      await expect(activeBadge).toHaveClass(/green/)
    })

    test('should show renewal date for active subscription', async ({ page }) => {
      const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: renewalDate.toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      // Should show renews on
      await expect(page.locator('text=Renews on')).toBeVisible()
    })
  })

  test.describe('Trialing Subscription', () => {
    test('should show blue Trialing badge', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'trialing',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      const trialingBadge = page.locator('span:has-text("Trialing")')
      await expect(trialingBadge).toBeVisible()
      await expect(trialingBadge).toHaveClass(/blue/)
    })
  })

  test.describe('Past Due Subscription', () => {
    test('should show yellow Past Due badge', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'past_due',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      const pastDueBadge = page.locator('span:has-text("Past due")')
      await expect(pastDueBadge).toBeVisible()
      await expect(pastDueBadge).toHaveClass(/yellow/)
    })
  })

  test.describe('Cancelled Subscription', () => {
    test('should show red Cancelled badge', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'cancelled',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      const cancelledBadge = page.locator('span:has-text("Cancelled")')
      await expect(cancelledBadge).toBeVisible()
      await expect(cancelledBadge).toHaveClass(/red/)
    })

    test('should show "Access until" for cancelled subscription', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'cancelled',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('text=Access until')).toBeVisible()
    })
  })

  test.describe('No Subscription', () => {
    test('should show "No active subscription" message', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: null,
              canManage: false,
              hasPaymentMethod: false,
            },
          }),
        })
      })

      await goToBilling(page)

      // Should NOT show subscription card when no subscription
      // Or show "No active subscription" message
      const noSubText = page.locator('text=No active subscription')
      const subsCard = page.locator('text=Subscription')

      // Either no subscription card or the card shows no subscription message
      const hasNoSubText = await noSubText.isVisible().catch(() => false)
      const hasSubsCard = await subsCard.isVisible().catch(() => false)

      expect(hasNoSubText || !hasSubsCard).toBeTruthy()
    })
  })

  test.describe('Manage Billing Button', () => {
    test('should show Manage Billing button when canManage and hasPaymentMethod', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('button:has-text("Manage Billing")')).toBeVisible()
    })

    test('should not show Manage Billing when hasPaymentMethod is false', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: false,
            },
          }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('button:has-text("Manage Billing")')).not.toBeVisible()
    })
  })

  test.describe('Cancel Subscription', () => {
    test('should show Cancel Subscription button for active subscription', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('button:has-text("Cancel Subscription")')).toBeVisible()
    })

    test('should show confirmation dialog on cancel click', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Cancel Subscription")')

      await expectDialog(page)
      await expect(page.locator('text=Cancel Subscription?')).toBeVisible()
    })

    test('should cancel subscription on confirmation', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await page.route('**/api/v1/billing/cancel', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { message: 'Subscription cancelled' } }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Cancel Subscription")')
      await page.click('button:has-text("Yes, Cancel")')

      // Should close dialog
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    })

    test('should keep subscription on "Keep Subscription" click', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await page.click('button:has-text("Cancel Subscription")')
      await page.click('button:has-text("Keep Subscription")')

      // Dialog should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()

      // Cancel button should still be visible
      await expect(page.locator('button:has-text("Cancel Subscription")')).toBeVisible()
    })
  })

  test.describe('Provider Info', () => {
    test('should show payment provider (Stripe)', async ({ page }) => {
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              subscription: {
                id: 1,
                status: 'active',
                tier: { id: 2, name: 'Tier 1', slug: 'tier1', description: 'Pro features' },
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                providerName: 'stripe',
                providerSubscriptionId: 'sub_123',
              },
              canManage: true,
              hasPaymentMethod: true,
            },
          }),
        })
      })

      await goToBilling(page)

      await expect(page.locator('text=Stripe').or(page.locator('text=via Stripe')).first()).toBeVisible()
    })
  })
})
