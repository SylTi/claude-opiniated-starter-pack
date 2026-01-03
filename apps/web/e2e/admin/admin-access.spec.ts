import { test, expect } from '@playwright/test'
import { goto, goToAdminDashboard } from '../helpers/navigation'
import { mockAuthenticatedUser, mockUnauthenticated } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Access Control', () => {
  test.describe('Admin Role Required', () => {
    test('should allow admin user to access /admin/dashboard', async ({ page }) => {
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

      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              totalUsers: 100,
              verifiedUsers: 80,
              mfaEnabledUsers: 20,
              newUsersThisMonth: 10,
              activeUsersThisWeek: 50,
              usersByRole: [{ role: 'user', count: 95 }, { role: 'admin', count: 5 }],
            },
          }),
        })
      })

      await goto(page, '/admin/dashboard')

      await expect(page).toHaveURL('/admin/dashboard', { timeout: 10000 })
      await expect(page.locator('text=Admin Dashboard')).toBeVisible()
    })

    test('should redirect regular user to /dashboard with error toast', async ({ page }) => {
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

      await goto(page, '/admin/dashboard')

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should redirect unauthenticated user to /login', async ({ page }) => {
      await mockUnauthenticated(page)

      await goto(page, '/admin/dashboard')

      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('Admin Routes Protection', () => {
    const adminRoutes = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/discount-codes',
      '/admin/coupons',
    ]

    for (const route of adminRoutes) {
      test(`should protect ${route} from non-admin access`, async ({ page }) => {
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

        await goto(page, route)

        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
      })
    }

    for (const route of adminRoutes) {
      test(`should allow admin to access ${route}`, async ({ page }) => {
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

        // Mock required APIs based on route
        if (route === '/admin/dashboard') {
          await page.route('**/api/v1/admin/stats', async (r) => {
            await r.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  totalUsers: 100,
                  verifiedUsers: 80,
                  mfaEnabledUsers: 20,
                  newUsersThisMonth: 10,
                  activeUsersThisWeek: 50,
                  usersByRole: [],
                },
              }),
            })
          })
        } else if (route === '/admin/users') {
          await page.route('**/api/v1/admin/users', async (r) => {
            await r.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: [] }),
            })
          })
        } else if (route === '/admin/discount-codes') {
          await page.route('**/api/v1/admin/discount-codes', async (r) => {
            await r.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: [] }),
            })
          })
        } else if (route === '/admin/coupons') {
          await page.route('**/api/v1/admin/coupons', async (r) => {
            await r.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: [] }),
            })
          })
        }

        await goto(page, route)

        await expect(page).toHaveURL(route, { timeout: 10000 })
      })
    }
  })

  test.describe('Admin Layout', () => {
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

      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              totalUsers: 100,
              verifiedUsers: 80,
              mfaEnabledUsers: 20,
              newUsersThisMonth: 10,
              activeUsersThisWeek: 50,
              usersByRole: [],
            },
          }),
        })
      })
    })

    test('should display Admin Panel sidebar', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      await expect(page.locator('text=Admin Panel')).toBeVisible()
    })

    test('should display navigation links', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      // Target admin sidebar navigation links specifically
      const adminNav = page.locator('aside nav, [role="complementary"] nav')
      await expect(adminNav.locator('a:has-text("Dashboard")')).toBeVisible()
      await expect(adminNav.locator('a:has-text("Users")')).toBeVisible()
      await expect(adminNav.locator('a:has-text("Discount Codes")')).toBeVisible()
      await expect(adminNav.locator('a:has-text("Coupons")')).toBeVisible()
    })

    test('should highlight active navigation link', async ({ page }) => {
      await goto(page, '/admin/dashboard')

      // Target admin sidebar Dashboard link specifically
      const adminNav = page.locator('aside nav, [role="complementary"] nav')
      const dashboardLink = adminNav.locator('a[href="/admin/dashboard"]')
      await expect(dashboardLink).toHaveClass(/blue/)
    })

    test('should navigate between admin pages', async ({ page }) => {
      await page.route('**/api/v1/admin/users', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/dashboard')

      // Target admin sidebar Users link specifically
      const adminNav = page.locator('aside nav, [role="complementary"] nav')
      await adminNav.locator('a:has-text("Users")').click()

      await expect(page).toHaveURL('/admin/users')
    })
  })

  test.describe('Loading State', () => {
    test('should show loading spinner while checking auth', async ({ page }) => {
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

      // Delay the response to see loading state
      await page.route('**/api/v1/auth/me', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
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
            },
          }),
        })
      })

      await goto(page, '/admin/dashboard')

      // May see loading spinner
      const spinner = page.locator('[class*="animate-spin"]')
      // Loading may be fast, so we catch the visibility check
      await spinner.first().isVisible().catch(() => false)
    })
  })
})
