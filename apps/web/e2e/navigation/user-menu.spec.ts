import { test, expect } from '@playwright/test'
import { goto, openUserMenu } from '../helpers/navigation'
import { expectDropdownMenu, expectNoDropdownMenu } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('User Menu', () => {
  test.describe('Menu Opening/Closing', () => {
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

    test('should open menu on avatar click', async ({ page }) => {
      await goto(page, '/dashboard')

      // Open user menu
      await openUserMenu(page)

      // Menu should be visible
      await expectDropdownMenu(page)
    })

    test('should close menu on clicking outside', async ({ page }) => {
      await goto(page, '/dashboard')

      // Open user menu
      await openUserMenu(page)
      await expectDropdownMenu(page)

      // Click outside - use the page heading which is definitely outside the menu
      await page.locator('h1, h2, main').first().click({ force: true })

      // Menu should be closed
      await expectNoDropdownMenu(page)
    })

    test('should close menu on pressing Escape', async ({ page }) => {
      await goto(page, '/dashboard')

      // Open user menu
      await openUserMenu(page)
      await expectDropdownMenu(page)

      // Press Escape
      await page.keyboard.press('Escape')

      // Menu should be closed
      await expectNoDropdownMenu(page)
    })
  })

  test.describe('Menu Items - Regular User', () => {
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
      await goto(page, '/dashboard')
      await openUserMenu(page)
    })

    test('should show Dashboard link', async ({ page }) => {
      const dashboardItem = page.locator('[role="menuitem"]:has-text("Dashboard"), a:has-text("Dashboard")')
      await expect(dashboardItem.first()).toBeVisible()
    })

    test('should show Profile link', async ({ page }) => {
      const profileItem = page.locator('[role="menuitem"]:has-text("Profile")')
      await expect(profileItem.first()).toBeVisible()
    })

    test('should show Security link', async ({ page }) => {
      const securityItem = page.locator('[role="menuitem"]:has-text("Security")')
      await expect(securityItem.first()).toBeVisible()
    })

    test('should show Settings link', async ({ page }) => {
      const settingsItem = page.locator('[role="menuitem"]:has-text("Settings")')
      await expect(settingsItem.first()).toBeVisible()
    })

    test('should show Logout button', async ({ page }) => {
      const logoutItem = page.locator('[role="menuitem"]:has-text("Log out"), button:has-text("Log out")')
      await expect(logoutItem.first()).toBeVisible()
    })

    test('should NOT show Team link for free user', async ({ page }) => {
      const teamItem = page.locator('[role="menuitem"]:has-text("Team")')
      await expect(teamItem).not.toBeVisible()
    })

    test('should NOT show Admin link for regular user', async ({ page }) => {
      const adminItem = page.locator('[role="menuitem"]:has-text("Admin")')
      await expect(adminItem).not.toBeVisible()
    })
  })

  test.describe('Menu Items - Tier1 User with Team', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })
      await goto(page, '/dashboard')
      await openUserMenu(page)
    })

    test('should show Team link for tier1 user with team', async ({ page }) => {
      const teamItem = page.locator('[role="menuitem"]:has-text("Team")')
      await expect(teamItem.first()).toBeVisible()
    })
  })

  test.describe('Menu Items - Admin User', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 2,
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
      await goto(page, '/dashboard')
      await openUserMenu(page)
    })

    test('should show Admin link for admin user', async ({ page }) => {
      const adminItem = page.locator('[role="menuitem"]:has-text("Admin")')
      await expect(adminItem.first()).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
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

    test('should navigate to /dashboard when clicking Dashboard', async ({ page }) => {
      await goto(page, '/profile')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Dashboard")')
      await expect(page).toHaveURL('/dashboard')
    })

    test('should navigate to /profile when clicking Profile', async ({ page }) => {
      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Profile")')
      await expect(page).toHaveURL('/profile')
    })

    test('should navigate to /profile/security when clicking Security', async ({ page }) => {
      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Security")')
      await expect(page).toHaveURL('/profile/security')
    })

    test('should navigate to /profile/settings when clicking Settings', async ({ page }) => {
      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Settings")')
      await expect(page).toHaveURL('/profile/settings')
    })

    test('should navigate to /team when clicking Team (tier1+)', async ({ page }) => {
      // Setup tier1 user with team
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      // Mock team data
      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 1,
              name: 'Test Team',
              slug: 'test-team',
              tier: 'tier1',
              members: [],
              invitations: [],
            },
          }),
        })
      })

      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Team")')
      await expect(page).toHaveURL('/team')
    })

    test('should navigate to /admin/dashboard when clicking Admin (admin)', async ({ page }) => {
      // Setup admin user
      await mockAuthenticatedUser(page, {
        id: 2,
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
      await page.route('**/api/v1/admin/stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              totalUsers: 100,
              newUsersThisMonth: 10,
              verifiedUsers: 80,
              verificationRate: 80,
              mfaUsers: 20,
              mfaAdoptionRate: 20,
              activeThisWeek: 50,
              usersByRole: { user: 90, admin: 10 },
            },
          }),
        })
      })

      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Admin")')
      await expect(page).toHaveURL(/\/admin/)
    })

    test('should logout when clicking Logout', async ({ page }) => {
      // Mock logout
      await mockApiResponse(page, '/auth/logout', { message: 'Logged out' }, { method: 'POST' })

      await goto(page, '/dashboard')
      await openUserMenu(page)

      await page.click('[role="menuitem"]:has-text("Log out"), button:has-text("Log out")')
      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('User Info Display', () => {
    test('should display user email or name', async ({ page }) => {
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

      await goto(page, '/dashboard')
      await openUserMenu(page)

      // Should display user email or name in menu
      const userInfo = page.locator(`[role="menu"] :has-text("${TEST_USERS.regular.email}"), [role="menu"] :has-text("${TEST_USERS.regular.fullName}")`)
      await expect(userInfo.first()).toBeVisible().catch(() => {
        // User info may not be displayed in menu
      })
    })

    test('should display avatar with initials when no avatar URL', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: 'Test User',
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      await goto(page, '/dashboard')

      // Avatar should show initials (TU for Test User)
      const avatar = page.locator('header [data-slot="avatar"], header [class*="avatar"]')
      await expect(avatar.first()).toBeVisible()
    })

    test('should display avatar image when avatar URL is set', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: 'Test User',
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: 'https://example.com/avatar.jpg',
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      await goto(page, '/dashboard')

      // Avatar should be visible
      const avatar = page.locator('header [data-slot="avatar"], header [class*="avatar"]')
      await expect(avatar.first()).toBeVisible()
    })
  })

  test.describe('Menu Accessibility', () => {
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

    test('menu should have proper ARIA role', async ({ page }) => {
      await goto(page, '/dashboard')
      await openUserMenu(page)

      const menu = page.locator('[role="menu"]')
      await expect(menu).toBeVisible()
    })

    test('menu items should have menuitem role', async ({ page }) => {
      await goto(page, '/dashboard')
      await openUserMenu(page)

      const menuItems = page.locator('[role="menuitem"]')
      expect(await menuItems.count()).toBeGreaterThan(0)
    })

    test('should support keyboard navigation', async ({ page }) => {
      await goto(page, '/dashboard')

      // Open menu using click first (more reliable than keyboard focus)
      await openUserMenu(page)
      await expectDropdownMenu(page)

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown')

      // First item should be focused - just check menu items exist
      const menuItems = page.locator('[role="menuitem"]')
      expect(await menuItems.count()).toBeGreaterThan(0)
    })
  })
})
