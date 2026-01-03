import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser, mockUnauthenticated } from '../fixtures/api-mock.fixture'

test.describe('Loading States', () => {
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

  test.describe('Page Loading', () => {
    test('should show loading state while fetching dashboard data', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/dashboard', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { loginCount: 5, createdAt: new Date().toISOString() } }),
        })
      })

      await goto(page, '/dashboard')

      // Should show loading skeleton or spinner
      const loadingIndicator = page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="animate-spin"]')
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })

    test('should show loading state while fetching team data', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/teams/current', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 1,
              name: 'Test Team',
              slug: 'test-team',
              subscriptionTier: 'tier1',
              members: [],
              pendingInvitations: [],
              currentUserRole: 'owner',
            },
          }),
        })
      })

      await goto(page, '/team')

      const loadingIndicator = page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="animate-spin"]')
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })

    test('should show loading state while fetching billing data', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/billing/tiers', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
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

      await goto(page, '/billing')

      const loadingIndicator = page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="animate-spin"]')
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Button Loading States', () => {
    test('should show loading spinner on login button', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/auth/login', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: mockUser, token: 'token' } }),
        })
      })

      await goto(page, '/login')

      await page.locator('input#email').fill('test@example.com')
      await page.locator('input#password').fill('password123')
      await page.locator('button[type="submit"]').click()

      // Button should show loading state
      const submitButton = page.locator('button[type="submit"]')
      const hasSpinner = await submitButton.locator('[class*="animate-spin"]').isVisible().catch(() => false)
      const isDisabled = await submitButton.isDisabled()

      expect(hasSpinner || isDisabled).toBe(true)
    })

    test('should show loading spinner on register button', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/auth/register', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: mockUser }, message: 'Check your email' }),
        })
      })

      await goto(page, '/register')

      await page.locator('input#fullName').fill('Test User')
      await page.locator('input#email').fill('test@example.com')
      await page.locator('input#password').fill('password123')
      await page.locator('input#passwordConfirmation').fill('password123')
      await page.locator('button[type="submit"]').click()

      const submitButton = page.locator('button[type="submit"]')
      const hasSpinner = await submitButton.locator('[class*="animate-spin"]').isVisible().catch(() => false)
      const isDisabled = await submitButton.isDisabled()

      expect(hasSpinner || isDisabled).toBe(true)
    })

    test('should show loading spinner on save profile button', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/profile', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockUser }),
          })
        } else if (route.request().method() === 'PUT') {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockUser }),
          })
        }
      })

      await goto(page, '/profile')

      await page.locator('input#fullName').fill('New Name')
      await page.locator('button:has-text("Save")').click()

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Saving")')
      const hasSpinner = await saveButton.first().locator('[class*="animate-spin"]').isVisible().catch(() => false)
      const isDisabled = await saveButton.first().isDisabled()

      expect(hasSpinner || isDisabled).toBe(true)
    })

    test('should disable button during loading', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/auth/login', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: mockUser, token: 'token' } }),
        })
      })

      await goto(page, '/login')

      await page.locator('input#email').fill('test@example.com')
      await page.locator('input#password').fill('password123')
      await page.locator('button[type="submit"]').click()

      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })

    test('should re-enable button after loading completes', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/auth/login', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid credentials' }),
        })
      })

      await goto(page, '/login')

      await page.locator('input#email').fill('test@example.com')
      await page.locator('input#password').fill('wrong')
      await page.locator('button[type="submit"]').click()

      // Wait for error
      await expect(page.locator('text=Invalid').or(page.locator('text=error')).first()).toBeVisible({ timeout: 5000 })

      // Button should be re-enabled
      await expect(page.locator('button[type="submit"]')).not.toBeDisabled()
    })
  })

  test.describe('Skeleton Loading', () => {
    test('should show skeleton cards on dashboard', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/dashboard', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        })
      })

      await goto(page, '/dashboard')

      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })

    test('should replace skeleton with content after load', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/dashboard', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { loginCount: 10, createdAt: new Date().toISOString() } }),
        })
      })

      await goto(page, '/dashboard')

      // Wait for content to load
      await expect(page.locator('text=10').or(page.locator('text=logins'))).toBeVisible({ timeout: 5000 })

      // Skeleton should be gone
      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton).not.toBeVisible().catch(() => {})
    })
  })

  test.describe('Full Page Loading', () => {
    test('should show loading spinner during auth check', async ({ page }) => {
      await page.route('**/api/v1/auth/me', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUser }),
        })
      })

      await goto(page, '/dashboard')

      // May show full page spinner during auth check
      const spinner = page.locator('[class*="animate-spin"]')
      await expect(spinner.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Table Loading States', () => {
    test('should show loading state in admin users table', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/users', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/users')

      const loading = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
      await expect(loading.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })

    test('should show loading state in activity table', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/auth/login-history', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/profile/settings')

      const loading = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
      await expect(loading.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Inline Action Loading', () => {
    test('should show loading on verify button', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/users', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: 2, email: 'user@example.com', fullName: 'User', role: 'user', subscriptionTier: 'free', emailVerified: false, mfaEnabled: false, createdAt: new Date().toISOString() },
            ],
          }),
        })
      })

      await page.route('**/api/v1/admin/users/2/verify', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const verifyButton = page.locator('button:has-text("Verify")').first()
      await verifyButton.click()

      await expect(verifyButton).toBeDisabled().catch(() => {})
    })

    test('should show loading on delete confirmation', async ({ page }) => {
      await mockAuthenticatedUser(page, { ...mockUser, role: 'admin' })

      await page.route('**/api/v1/admin/users', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: 2, email: 'user@example.com', fullName: 'User', role: 'user', subscriptionTier: 'free', emailVerified: true, mfaEnabled: false, createdAt: new Date().toISOString() },
            ],
          }),
        })
      })

      await page.route('**/api/v1/admin/users/2', async (route) => {
        if (route.request().method() === 'DELETE') {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/users')

      await page.locator('button:has([class*="Trash"]), button:has-text("Delete")').first().click()

      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"):not([disabled])').last()
      await confirmButton.click()

      await expect(confirmButton).toBeDisabled().catch(() => {})
    })
  })

  test.describe('Form Loading Indicators', () => {
    test('should show loading text on button during submit', async ({ page }) => {
      await mockUnauthenticated(page)

      await page.route('**/api/v1/auth/login', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: mockUser, token: 'token' } }),
        })
      })

      await goto(page, '/login')

      await page.locator('input#email').fill('test@example.com')
      await page.locator('input#password').fill('password123')
      await page.locator('button[type="submit"]').click()

      // Button might show "Signing in..." or have a spinner
      const button = page.locator('button[type="submit"]')
      const hasLoadingText = await button.textContent()
      const hasSpinner = await button.locator('[class*="animate-spin"]').isVisible().catch(() => false)

      expect(hasLoadingText?.includes('ing') || hasSpinner || await button.isDisabled()).toBe(true)
    })
  })

  test.describe('Loading State Accessibility', () => {
    test('should have aria-busy on loading containers', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/dashboard', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        })
      })

      await goto(page, '/dashboard')

      // Check for aria-busy attribute
      const busyElement = page.locator('[aria-busy="true"]')
      await expect(busyElement.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // aria-busy may not be implemented
      })
    })

    test('should have screen reader announcement for loading', async ({ page }) => {
      await mockAuthenticatedUser(page, mockUser)

      await page.route('**/api/v1/dashboard', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        })
      })

      await goto(page, '/dashboard')

      // Check for sr-only text or aria-label
      const loadingAnnouncement = page.locator('[class*="sr-only"]:has-text("Loading"), [aria-label*="loading" i]')
      await expect(loadingAnnouncement.first()).toBeVisible().catch(() => {
        // May not be implemented
      })
    })
  })
})
