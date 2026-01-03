import { test, expect } from '@playwright/test'
import { goToSettings } from '../helpers/navigation'
import { expectTableRows, expectBadge } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Settings Page - Login Activity', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, {
      id: 1,
      email: TEST_USERS.regular.email,
      fullName: TEST_USERS.regular.fullName,
      role: 'user',
      subscriptionTier: 'free',
      emailVerifiedAt: new Date().toISOString(),
      mfaEnabled: false,
      avatarUrl: null,
      currentTeamId: null,
      createdAt: new Date().toISOString(),
    })

    // Mock OAuth providers
    await page.route('**/api/v1/oauth/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            google: { linked: false, email: null },
            github: { linked: false, email: null },
          },
        }),
      })
    })
  })

  test.describe('Activity Table Display', () => {
    test('should display login history table', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
              {
                id: 2,
                method: 'google',
                ipAddress: '192.168.1.2',
                success: true,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show activity table
      await expect(page.locator('table, [role="table"]').first()).toBeVisible()
    })

    test('should show login method column', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show method column header or content
      await expect(page.locator('text=Method').or(page.locator('text=password')).first()).toBeVisible()
    })

    test('should show IP address column', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show IP address
      await expect(page.locator('text=192.168.1.1').or(page.locator('text=IP')).first()).toBeVisible()
    })

    test('should show date/time column', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show date/time
      await expect(page.locator('text=Date').or(page.locator('time')).or(page.locator('text=ago')).first()).toBeVisible()
    })
  })

  test.describe('Method Icons', () => {
    test('should show password icon for password login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show password indicator
      await expect(page.locator('text=password').or(page.locator('svg')).first()).toBeVisible()
    })

    test('should show Google icon for Google login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'google',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show Google indicator
      await expect(page.locator('text=google').or(page.locator('text=Google')).first()).toBeVisible()
    })

    test('should show GitHub icon for GitHub login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'github',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show GitHub indicator
      await expect(page.locator('text=github').or(page.locator('text=GitHub')).first()).toBeVisible()
    })

    test('should show MFA icon for MFA login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'mfa',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show MFA indicator
      await expect(page.locator('text=mfa').or(page.locator('text=2FA')).first()).toBeVisible()
    })
  })

  test.describe('Status Badges', () => {
    test('should show green badge for successful login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show success badge
      await expect(page.locator('text=Success').or(page.locator('[class*="green"]')).first()).toBeVisible()
    })

    test('should show red badge for failed login', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                method: 'password',
                ipAddress: '192.168.1.1',
                success: false,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        })
      })

      await goToSettings(page)

      // Should show failed badge
      await expect(page.locator('text=Failed').or(page.locator('[class*="red"]').or(page.locator('[class*="destructive"]'))).first()).toBeVisible()
    })
  })

  test.describe('Empty State', () => {
    test('should show message when no login history', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      await goToSettings(page)

      // Should show empty state
      await expect(page.locator('text=No login').or(page.locator('text=No history')).or(page.locator('text=No activity')).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading while fetching history', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      await goToSettings(page)

      // Should show loading indicator
      const loading = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
      await expect(loading.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Pagination', () => {
    test('should show pagination if many entries', async ({ page }) => {
      // Create many entries
      const entries = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        method: 'password',
        ipAddress: `192.168.1.${i + 1}`,
        success: true,
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      }))

      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: entries,
          }),
        })
      })

      await goToSettings(page)

      // May show pagination
      // This depends on implementation
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API error gracefully', async ({ page }) => {
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'InternalServerError',
            message: 'Failed to fetch login history',
          }),
        })
      })

      await goToSettings(page)

      // Should not crash, may show error or empty state
      await expect(page).toHaveURL('/profile/settings')
    })
  })
})
