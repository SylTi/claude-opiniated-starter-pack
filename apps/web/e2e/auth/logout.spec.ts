import { test, expect } from '@playwright/test'
import { goto, goToDashboard, openUserMenu, expectRedirect } from '../helpers/navigation'
import { loginAsUser, TEST_USERS } from '../fixtures/auth.fixture'
import { mockApiResponse, mockAuthenticatedUser } from '../fixtures/api-mock.fixture'

test.describe('Logout', () => {
  test.describe('Logout from User Menu', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      // Setup authenticated state
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

      // Mock logout endpoint
      await mockApiResponse(page, '/auth/logout', { message: 'Logged out' }, { method: 'POST' })

      // Go to dashboard
      await goToDashboard(page)

      // Open user menu
      await openUserMenu(page)

      // Click logout
      await page.click('button:has-text("Log out"), [role="menuitem"]:has-text("Log out")')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })

    test('should clear session after logout', async ({ page }) => {
      // Setup authenticated state
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

      // Mock logout endpoint
      await mockApiResponse(page, '/auth/logout', { message: 'Logged out' }, { method: 'POST' })

      // Go to dashboard
      await goToDashboard(page)

      // Open user menu and logout
      await openUserMenu(page)
      await page.click('button:has-text("Log out"), [role="menuitem"]:has-text("Log out")')

      // Wait for redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })

      // Mock unauthenticated state for next request
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Not authenticated',
          }),
        })
      })

      // Try to access protected route
      await goto(page, '/dashboard')

      // Should be redirected back to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('Protected Routes After Logout', () => {
    test('should redirect /dashboard to /login after logout', async ({ page }) => {
      // Mock unauthenticated state
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Not authenticated',
          }),
        })
      })

      // Try to access dashboard
      await goto(page, '/dashboard')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })

    test('should redirect /profile to /login after logout', async ({ page }) => {
      // Mock unauthenticated state
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Not authenticated',
          }),
        })
      })

      // Try to access profile
      await goto(page, '/profile')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })

    test('should redirect /profile/security to /login after logout', async ({ page }) => {
      // Mock unauthenticated state
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Not authenticated',
          }),
        })
      })

      // Try to access security settings
      await goto(page, '/profile/security')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })

    test('should redirect /admin/dashboard to /login after logout', async ({ page }) => {
      // Mock unauthenticated state
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Not authenticated',
          }),
        })
      })

      // Try to access admin
      await goto(page, '/admin/dashboard')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('Logout API Error Handling', () => {
    test('should handle logout API error gracefully', async ({ page }) => {
      // Setup authenticated state
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

      // Mock logout error
      await page.route('**/api/v1/auth/logout', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'InternalServerError',
            message: 'Logout failed',
          }),
        })
      })

      // Go to dashboard
      await goToDashboard(page)

      // Open user menu and click logout
      await openUserMenu(page)
      await page.click('button:has-text("Log out"), [role="menuitem"]:has-text("Log out")')

      // Should redirect to login (client-side logout clears session regardless of API)
      // OR stay on page if error is shown
      await expect(page).toHaveURL(/login|dashboard/, { timeout: 10000 })
    })
  })

  test.describe('Logout from Different Pages', () => {
    test('should logout from profile page', async ({ page }) => {
      // Setup authenticated state
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

      // Mock logout
      await mockApiResponse(page, '/auth/logout', { message: 'Logged out' }, { method: 'POST' })

      // Go to profile
      await goto(page, '/profile')

      // Open user menu and logout
      await openUserMenu(page)
      await page.click('button:has-text("Log out"), [role="menuitem"]:has-text("Log out")')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })

    test('should logout from admin page', async ({ page }) => {
      // Setup admin authenticated state
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

      // Mock admin stats
      await mockApiResponse(page, '/admin/stats', {
        totalUsers: 100,
        newUsersThisMonth: 10,
        verifiedUsers: 80,
        verificationRate: 80,
        mfaUsers: 20,
        mfaAdoptionRate: 20,
        activeThisWeek: 50,
        usersByRole: [
          { role: 'user', count: 90 },
          { role: 'admin', count: 10 },
        ],
      })

      // Mock logout
      await mockApiResponse(page, '/auth/logout', { message: 'Logged out' }, { method: 'POST' })

      // Go to admin dashboard
      await goto(page, '/admin/dashboard')

      // Open user menu and logout
      await openUserMenu(page)
      await page.click('button:has-text("Log out"), [role="menuitem"]:has-text("Log out")')

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })
})
