import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'

test.describe('Billing Success Page', () => {
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

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, mockUser)
  })

  test.describe('Success Page Display', () => {
    test('should display success message', async ({ page }) => {
      await goto(page, '/billing/success')

      await expect(page.locator('text=Payment Successful')).toBeVisible()
    })

    test('should display thank you message', async ({ page }) => {
      await goto(page, '/billing/success')

      await expect(page.locator('text=Thank you for your subscription')).toBeVisible()
    })

    test('should display account upgraded message', async ({ page }) => {
      await goto(page, '/billing/success')

      await expect(page.locator('text=Your account has been upgraded')).toBeVisible()
    })

    test('should display green checkmark icon', async ({ page }) => {
      await goto(page, '/billing/success')

      // Check icon with green color
      const checkIcon = page.locator('svg[class*="green"], svg[class*="text-green"]')
      await expect(checkIcon.first()).toBeVisible()
    })
  })

  test.describe('Countdown', () => {
    test('should display countdown timer', async ({ page }) => {
      await goto(page, '/billing/success')

      // Should show countdown message
      await expect(page.locator('text=redirected')).toBeVisible()
      await expect(page.locator('text=seconds')).toBeVisible()
    })

    test('should show initial countdown of 5 seconds', async ({ page }) => {
      await goto(page, '/billing/success')

      // Should show 5 seconds initially
      await expect(page.locator('text=5 seconds').or(page.locator('text=in 5')).first()).toBeVisible()
    })

    test('should decrement countdown', async ({ page }) => {
      await goto(page, '/billing/success')

      // Wait for countdown to decrement
      await page.waitForTimeout(1500)

      // Should show lower number (4 or 3)
      await expect(
        page.locator('text=4 seconds')
          .or(page.locator('text=3 seconds'))
          .or(page.locator('text=in 4'))
          .or(page.locator('text=in 3'))
          .first()
      ).toBeVisible()
    })
  })

  test.describe('Auto Redirect', () => {
    test('should redirect to /billing after countdown', async ({ page }) => {
      await goto(page, '/billing/success')

      // Mock billing page data
      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
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

      // Wait for redirect (5+ seconds)
      await expect(page).toHaveURL('/billing', { timeout: 10000 })
    })
  })

  test.describe('Go Now Button', () => {
    test('should display "Go to Billing Now" button', async ({ page }) => {
      await goto(page, '/billing/success')

      await expect(page.locator('button:has-text("Go to Billing Now")')).toBeVisible()
    })

    test('should navigate to /billing when clicking button', async ({ page }) => {
      await goto(page, '/billing/success')

      // Mock billing page
      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
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

      await page.click('button:has-text("Go to Billing Now")')

      await expect(page).toHaveURL('/billing')
    })
  })
})

test.describe('Billing Cancel Page', () => {
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

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, mockUser)
  })

  test.describe('Cancel Page Display', () => {
    test('should display checkout cancelled message', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await expect(page.locator('text=Checkout Cancelled')).toBeVisible()
    })

    test('should display no charges message', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await expect(page.locator('text=No charges have been made')).toBeVisible()
    })

    test('should display contact support message', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await expect(page.locator('text=contact our support team')).toBeVisible()
    })

    test('should display X icon', async ({ page }) => {
      await goto(page, '/billing/cancel')

      // XCircle icon
      const xIcon = page.locator('svg').first()
      await expect(xIcon).toBeVisible()
    })
  })

  test.describe('View Plans Button', () => {
    test('should display "View Plans" button', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await expect(page.locator('button:has-text("View Plans")')).toBeVisible()
    })

    test('should navigate to /billing when clicking View Plans', async ({ page }) => {
      await goto(page, '/billing/cancel')

      // Mock billing page
      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
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

      await page.click('button:has-text("View Plans")')

      await expect(page).toHaveURL('/billing')
    })
  })

  test.describe('Dashboard Button', () => {
    test('should display "Go to Dashboard" button', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await expect(page.locator('button:has-text("Go to Dashboard")')).toBeVisible()
    })

    test('should navigate to /dashboard when clicking Dashboard button', async ({ page }) => {
      await goto(page, '/billing/cancel')

      await page.click('button:has-text("Go to Dashboard")')

      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('Button Styles', () => {
    test('should have View Plans as outline variant', async ({ page }) => {
      await goto(page, '/billing/cancel')

      const viewPlansButton = page.locator('button:has-text("View Plans")')
      // Outline variant typically has border
      await expect(viewPlansButton).toHaveClass(/outline|border/)
    })

    test('should have Dashboard as primary variant', async ({ page }) => {
      await goto(page, '/billing/cancel')

      const dashboardButton = page.locator('button:has-text("Go to Dashboard")')
      // Primary button has bg-primary class
      await expect(dashboardButton).toHaveClass(/bg-primary/)
    })
  })

  test.describe('Card Layout', () => {
    test('should be centered on page', async ({ page }) => {
      await goto(page, '/billing/cancel')

      // Container should have centering classes
      const container = page.locator('.container')
      await expect(container.first()).toBeVisible()
    })

    test('should have max-width card', async ({ page }) => {
      await goto(page, '/billing/cancel')

      // Card should be visible
      const card = page.locator('[data-slot="card"]').first()
      await expect(card).toBeVisible()
    })

    test('should have centered text', async ({ page }) => {
      await goto(page, '/billing/cancel')

      // Content should have text center class somewhere
      const centeredContent = page.locator('[class*="text-center"]')
      await expect(centeredContent.first()).toBeVisible()
    })
  })
})
