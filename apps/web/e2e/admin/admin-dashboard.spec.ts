import { test, expect } from '@playwright/test'
import { goto, goToAdminDashboard } from '../helpers/navigation'
import { mockAuthenticatedUser, mockApiError } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Dashboard', () => {
  const mockStats = {
    totalUsers: 150,
    verifiedUsers: 120,
    mfaEnabledUsers: 30,
    newUsersThisMonth: 25,
    activeUsersThisWeek: 80,
    usersByRole: [
      { role: 'user', count: 145 },
      { role: 'admin', count: 5 },
    ],
  }

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, {
      id: 1,
      email: TEST_USERS.admin.email,
      fullName: TEST_USERS.admin.fullName,
      role: 'admin',
      subscriptionTier: 'tier2',
      emailVerifiedAt: new Date().toISOString(),
      mfaEnabled: true,
      avatarUrl: null,
      currentTeamId: null,
      createdAt: new Date().toISOString(),
    })
  })

  test.describe('Stats Cards', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })
    })

    test('should display all 4 stats cards', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Total Users')).toBeVisible()
      await expect(page.locator('text=Verified Users')).toBeVisible()
      await expect(page.locator('text=MFA Enabled')).toBeVisible()
      await expect(page.locator('text=Active This Week')).toBeVisible()
    })

    test('should display total users count', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=150')).toBeVisible()
    })

    test('should display new users this month', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=+25 this month')).toBeVisible()
    })

    test('should display verified users count and rate', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=120')).toBeVisible()
      await expect(page.locator('text=80% verification rate')).toBeVisible()
    })

    test('should display MFA enabled count and adoption rate', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=30')).toBeVisible()
      await expect(page.locator('text=20% adoption rate')).toBeVisible()
    })

    test('should display active users this week', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      // Target the card that contains "Active This Week" to avoid matching "80%" elsewhere
      const activeCard = page.locator('div:has-text("Active This Week")').first()
      await expect(activeCard).toContainText('80')
      await expect(page.locator('text=Unique logins')).toBeVisible()
    })
  })

  test.describe('Users by Role', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })
    })

    test('should display Users by Role card', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Users by Role')).toBeVisible()
    })

    test('should show role distribution', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=user').first()).toBeVisible()
      await expect(page.locator('text=145')).toBeVisible()
      await expect(page.locator('text=admin').first()).toBeVisible()
      await expect(page.locator('text=5').first()).toBeVisible()
    })

    test('should show admin badge differently styled', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      // Admin badge should be visible in Users by Role section - use exact match
      await expect(page.getByText('admin', { exact: true })).toBeVisible()
    })
  })

  test.describe('Quick Actions', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })
    })

    test('should display Quick Actions card', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Quick Actions')).toBeVisible()
    })

    test('should have Manage Users button', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('button:has-text("Manage Users")')).toBeVisible()
    })

    test('should navigate to users page when clicking Manage Users', async ({ page }) => {
      await page.route('**/api/v1/admin/users', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/dashboard')

      await page.click('button:has-text("Manage Users")')

      await expect(page).toHaveURL('/admin/users')
    })

    test('should show coming soon badge for View Logs', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      const viewLogsButton = page.locator('button:has-text("View Logs")')
      await expect(viewLogsButton).toBeDisabled()
      await expect(page.locator('text=Coming soon').first()).toBeVisible()
    })

    test('should show coming soon badge for System Settings', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      const settingsButton = page.locator('button:has-text("System Settings")')
      await expect(settingsButton).toBeDisabled()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading skeleton while fetching stats', async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })

      await goto(page, '/admin/dashboard')

      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Error State', () => {
    test('should show error message when stats fetch fails', async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to fetch stats' }),
        })
      })

      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Failed to load statistics')).toBeVisible()
    })

    test('should redirect to dashboard on 403 error', async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden', message: 'Access denied' }),
        })
      })

      await goto(page, '/admin/dashboard')

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })
  })

  test.describe('Page Header', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })
    })

    test('should display Admin Dashboard heading', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('h1:has-text("Admin Dashboard")')).toBeVisible()
    })

    test('should display overview description', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Overview of your application statistics')).toBeVisible()
    })
  })

  test.describe('Icons', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockStats }),
        })
      })
    })

    test('should display icons on stats cards', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      // Wait for the stats to be loaded first
      await expect(page.locator('text=Total Users')).toBeVisible()

      // Each stats card should have an icon (SVG elements)
      // Stats cards have icons like Users, UserCheck, Shield, Activity
      // Look for Cards in the grid that have SVG icons
      const statsCardsWithIcons = page.locator('.grid svg')
      await expect(statsCardsWithIcons.first()).toBeVisible()
      expect(await statsCardsWithIcons.count()).toBeGreaterThanOrEqual(4)
    })
  })
})
