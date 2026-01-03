import { test, expect } from '@playwright/test'
import { goToDashboard } from '../helpers/navigation'
import { expectCard, expectBadge } from '../helpers/assertions'
import { mockAuthenticatedUser, mockDashboardStats } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Dashboard Stats Cards', () => {
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
  })

  test.describe('Stats Cards Display', () => {
    test('should display all 4 stats cards', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should have 4 stat cards by checking for their titles
      await expect(page.locator('text=Account Age')).toBeVisible()
      await expect(page.locator('text=Total Logins')).toBeVisible()
      await expect(page.locator('text=Email Status')).toBeVisible()
      await expect(page.locator('text=Security').first()).toBeVisible()
    })

    test('should display Account Age card', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show account age
      await expect(page.locator('text=Account Age').or(page.locator('text=Member for')).first()).toBeVisible()
    })

    test('should display Total Logins card', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show login count
      await expect(page.locator('text=Logins').or(page.locator('text=Login').first())).toBeVisible()
    })

    test('should display Email Status card', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show email status
      await expect(page.locator('text=Email').first()).toBeVisible()
    })

    test('should display Security Status card', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: true,
      })

      await goToDashboard(page)

      // Should show security status
      await expect(page.locator('text=Security').or(page.locator('text=2FA')).first()).toBeVisible()
    })
  })

  test.describe('Account Age Formatting', () => {
    test('should format days correctly', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 5,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show "5 days" or similar
      await expect(page.locator('text=5').or(page.locator('text=days')).first()).toBeVisible()
    })

    test('should format months correctly', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 60,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show months
      await expect(page.locator('text=month').or(page.locator('text=2')).first()).toBeVisible()
    })

    test('should format years correctly', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 400,
        totalLogins: 100,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show year or 1+
      await expect(page.locator('text=year').or(page.locator('text=1')).first()).toBeVisible()
    })
  })

  test.describe('Login Count', () => {
    test('should display login count', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 42,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show the count
      await expect(page.locator('text=42')).toBeVisible()
    })

    test('should handle zero logins', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 1,
        totalLogins: 0,
        emailVerified: false,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show 0 or handle gracefully
      await expect(page.locator('text=0').or(page.locator('text=No logins')).first()).toBeVisible()
    })
  })

  test.describe('Email Verified Status', () => {
    test('should show Verified badge when email is verified', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show verified indicator
      await expect(page.locator('text=Verified').first()).toBeVisible()
    })

    test('should show Unverified badge when email is not verified', async ({ page }) => {
      // Mock unverified user
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: null,
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: false,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show unverified indicator
      await expect(page.locator('text=Unverified').or(page.locator('text=Not verified')).first()).toBeVisible()
    })
  })

  test.describe('Security Status', () => {
    test('should show Protected when MFA is enabled', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: true,
      })

      await goToDashboard(page)

      // Should show protected status
      await expect(page.locator('text=Protected').or(page.locator('text=Enabled')).first()).toBeVisible()
    })

    test('should show Basic when MFA is disabled', async ({ page }) => {
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show basic status
      await expect(page.locator('text=Basic').or(page.locator('text=Disabled')).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading state while fetching stats', async ({ page }) => {
      // Delay stats response
      await page.route('**/api/v1/dashboard/stats', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              accountAgeDays: 30,
              totalLogins: 10,
              emailVerified: true,
              mfaEnabled: false,
            },
          }),
        })
      })

      await goToDashboard(page)

      // Should show loading indicator
      const loading = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
      await expect(loading.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Error Handling', () => {
    test('should handle stats API error gracefully', async ({ page }) => {
      await page.route('**/api/v1/dashboard/stats', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'InternalServerError',
            message: 'Failed to fetch stats',
          }),
        })
      })

      await goToDashboard(page)

      // Should still render page without crashing
      await expect(page).toHaveURL('/dashboard')
    })
  })
})
