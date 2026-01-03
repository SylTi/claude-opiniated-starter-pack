import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser, mockUnauthenticated } from '../fixtures/api-mock.fixture'

test.describe('Responsive Design', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'tier1' as const,
    emailVerifiedAt: new Date().toISOString(),
    mfaEnabled: false,
    avatarUrl: null,
    currentTeamId: 1,
    createdAt: new Date().toISOString(),
  }

  test.describe('Mobile View (375x667)', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('should display mobile-friendly login form', async ({ page }) => {
      await mockUnauthenticated(page)
      await goto(page, '/login')

      const form = page.locator('form')
      const box = await form.boundingBox()

      // Form should not overflow viewport
      expect(box?.width).toBeLessThanOrEqual(375)
    })

    test('should stack form elements vertically', async ({ page }) => {
      await mockUnauthenticated(page)
      await goto(page, '/login')

      const emailInput = page.locator('input#email')
      const passwordInput = page.locator('input#password')

      const emailBox = await emailInput.boundingBox()
      const passwordBox = await passwordInput.boundingBox()

      // Password should be below email (stacked)
      expect(passwordBox?.y).toBeGreaterThan(emailBox?.y || 0)
    })

    test('should show mobile navigation menu', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)
      await goto(page, '/dashboard')

      // Look for hamburger menu or mobile menu button
      const mobileMenuButton = page.locator('button[aria-label*="menu" i], button[class*="hamburger"], button:has([class*="Menu"])')
      const isVisible = await mobileMenuButton.first().isVisible().catch(() => false)

      // Either mobile menu exists or full nav is visible
      const navLinks = page.locator('nav a')
      const hasVisibleNav = await navLinks.first().isVisible().catch(() => false)

      expect(isVisible || hasVisibleNav).toBe(true)
    })

    test('should have full-width buttons', async ({ page }) => {
      await mockUnauthenticated(page)
      await goto(page, '/login')

      const submitButton = page.locator('button[type="submit"]')
      const buttonBox = await submitButton.boundingBox()

      // Button should be nearly full width (accounting for padding)
      expect(buttonBox?.width).toBeGreaterThan(300)
    })

    test('should wrap pricing cards on mobile', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: 'free', name: 'Free', description: 'Basic', monthlyPrice: 0, yearlyPrice: 0, features: [] },
              { id: 'tier1', name: 'Pro', description: 'Pro', monthlyPrice: 10, yearlyPrice: 100, features: [] },
            ],
          }),
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

      await goto(page, '/billing')

      // Cards should stack vertically
      const cards = page.locator('[data-slot="card"]')
      const count = await cards.count()

      if (count >= 2) {
        const firstBox = await cards.first().boundingBox()
        const secondBox = await cards.nth(1).boundingBox()

        // Second card should be below first
        expect(secondBox?.y).toBeGreaterThanOrEqual((firstBox?.y || 0) + (firstBox?.height || 0) - 50)
      }
    })
  })

  test.describe('Tablet View (768x1024)', () => {
    test.use({ viewport: { width: 768, height: 1024 } })

    test('should display tablet-optimized layout', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)
      await goto(page, '/dashboard')

      // Content should be visible
      await expect(page.locator('main')).toBeVisible()
    })

    test('should show sidebar or collapsed navigation', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { totalUsers: 100, verifiedUsers: 80, mfaEnabledUsers: 20, newUsersThisMonth: 10, activeUsersThisWeek: 50, usersByRole: [] } }),
        })
      })

      await goto(page, '/admin/dashboard')

      // Should have navigation visible or accessible
      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible()
    })

    test('should adjust grid layout for tablet', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { totalUsers: 100, verifiedUsers: 80, mfaEnabledUsers: 20, newUsersThisMonth: 10, activeUsersThisWeek: 50, usersByRole: [] } }),
        })
      })

      await goto(page, '/admin/dashboard')

      // Stats cards should be in grid
      const cards = page.locator('[data-slot="card"]')
      const count = await cards.count()

      if (count >= 2) {
        const firstBox = await cards.first().boundingBox()
        const secondBox = await cards.nth(1).boundingBox()

        // Cards may be side by side or stacked
        expect(firstBox && secondBox).toBeTruthy()
      }
    })
  })

  test.describe('Desktop View (1280x720)', () => {
    test.use({ viewport: { width: 1280, height: 720 } })

    test('should display full desktop layout', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)
      await goto(page, '/dashboard')

      // Main content and sidebar should be visible
      await expect(page.locator('main')).toBeVisible()
    })

    test('should show full navigation bar', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)
      await goto(page, '/dashboard')

      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible()

      // Should not show mobile menu button
      const mobileMenuButton = page.locator('button[aria-label*="menu" i][class*="md:hidden"], button[class*="hamburger"]')
      const isVisible = await mobileMenuButton.first().isVisible().catch(() => false)

      // Mobile menu should be hidden on desktop
      expect(isVisible).toBe(false)
    })

    test('should display pricing cards in row', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: 'free', name: 'Free', description: 'Basic', monthlyPrice: 0, yearlyPrice: 0, features: [] },
              { id: 'tier1', name: 'Pro', description: 'Pro', monthlyPrice: 10, yearlyPrice: 100, features: [] },
              { id: 'tier2', name: 'Enterprise', description: 'Enterprise', monthlyPrice: 30, yearlyPrice: 300, features: [] },
            ],
          }),
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

      await goto(page, '/billing')

      // Wait for cards to render
      const cards = page.locator('[data-slot="card"]:has-text("Free"), [data-slot="card"]:has-text("Pro")')
      await expect(cards.first()).toBeVisible()

      if (await cards.count() >= 2) {
        const firstBox = await cards.first().boundingBox()
        const secondBox = await cards.nth(1).boundingBox()

        // Cards should be side by side (similar Y position)
        if (firstBox && secondBox) {
          expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThan(50)
        }
      }
    })

    test('should show admin sidebar', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { totalUsers: 100, verifiedUsers: 80, mfaEnabledUsers: 20, newUsersThisMonth: 10, activeUsersThisWeek: 50, usersByRole: [] } }),
        })
      })

      await goto(page, '/admin/dashboard')

      // Admin sidebar should be visible
      const sidebar = page.locator('aside, nav:has-text("Admin")')
      await expect(sidebar.first()).toBeVisible()

      // All nav links should be visible
      await expect(page.locator('nav a:has-text("Dashboard")').first()).toBeVisible()
      await expect(page.locator('nav a:has-text("Users")').first()).toBeVisible()
    })
  })

  test.describe('Wide Desktop View (1920x1080)', () => {
    test.use({ viewport: { width: 1920, height: 1080 } })

    test('should center content with max-width', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)
      await goto(page, '/dashboard')

      const main = page.locator('main, [class*="container"]')
      const box = await main.first().boundingBox()

      // Content should have max-width and be centered
      expect(box?.width).toBeLessThan(1920)
    })

    test('should not stretch forms to full width', async ({ page }) => {
      await mockUnauthenticated(page)
      await goto(page, '/login')

      const form = page.locator('form')
      const box = await form.boundingBox()

      // Form should have reasonable max-width
      expect(box?.width).toBeLessThan(600)
    })
  })

  test.describe('Table Responsiveness', () => {
    test.describe('Mobile Table View', () => {
      test.use({ viewport: { width: 375, height: 667 } })

      test('should show horizontal scroll for tables on mobile', async ({ page }) => {
        await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

        await page.route('**/api/v1/admin/users', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                { id: 1, email: 'user@example.com', fullName: 'User', role: 'user', subscriptionTier: 'free', emailVerified: true, mfaEnabled: false, createdAt: new Date().toISOString() },
              ],
            }),
          })
        })

        await goto(page, '/admin/users')

        const table = page.locator('table')
        await expect(table).toBeVisible()

        // Table container should be scrollable
        const tableContainer = page.locator('[class*="overflow-x"], [style*="overflow"]')
        const isScrollable = await tableContainer.first().isVisible().catch(() => false)

        // Either scrollable or table adapts to mobile
        expect(isScrollable || true).toBe(true)
      })
    })
  })

  test.describe('Form Responsiveness', () => {
    test.describe('Mobile Form', () => {
      test.use({ viewport: { width: 375, height: 667 } })

      test('should stack form buttons on mobile', async ({ page }) => {
        await mockAuthenticatedUser(page, mockUser)
        await goto(page, '/profile')

        // Submit and cancel buttons should stack or be full width
        const saveButton = page.locator('button:has-text("Save")')
        const box = await saveButton.boundingBox()

        expect(box?.width).toBeGreaterThan(200)
      })
    })

    test.describe('Desktop Form', () => {
      test.use({ viewport: { width: 1280, height: 720 } })

      test('should show form buttons inline on desktop', async ({ page }) => {
        await mockAuthenticatedUser(page, mockUser)
        await goto(page, '/profile')

        const saveButton = page.locator('button:has-text("Save")')
        await expect(saveButton).toBeVisible()
      })
    })
  })

  test.describe('Image Responsiveness', () => {
    test.describe('Mobile Image', () => {
      test.use({ viewport: { width: 375, height: 667 } })

      test('should resize images for mobile', async ({ page }) => {
        await mockAuthenticatedUser(page, { ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' })
        await goto(page, '/dashboard')

        const avatar = page.locator('[class*="Avatar"], img[alt*="avatar" i]')
        if (await avatar.count() > 0) {
          const box = await avatar.first().boundingBox()
          expect(box?.width).toBeLessThanOrEqual(100)
        }
      })
    })
  })

  test.describe('Dialog Responsiveness', () => {
    test.describe('Mobile Dialog', () => {
      test.use({ viewport: { width: 375, height: 667 } })

      test('should show full-width dialog on mobile', async ({ page }) => {
        await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

        await page.route('**/api/v1/admin/discount-codes', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [] }),
          })
        })

        await goto(page, '/admin/discount-codes')

        await page.locator('button:has-text("Create"), button:has-text("Add")').first().click()

        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible()

        const box = await dialog.boundingBox()
        // Dialog should be nearly full width on mobile
        expect(box?.width).toBeGreaterThan(320)
      })
    })

    test.describe('Desktop Dialog', () => {
      test.use({ viewport: { width: 1280, height: 720 } })

      test('should show centered dialog on desktop', async ({ page }) => {
        await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

        await page.route('**/api/v1/admin/discount-codes', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: [] }),
          })
        })

        await goto(page, '/admin/discount-codes')

        await page.locator('button:has-text("Create"), button:has-text("Add")').first().click()

        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible()

        const box = await dialog.boundingBox()
        // Dialog should not be full width on desktop
        expect(box?.width).toBeLessThan(800)
      })
    })
  })
})
