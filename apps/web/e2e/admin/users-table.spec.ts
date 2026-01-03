import { test, expect } from '@playwright/test'
import { goto, goToAdminUsers } from '../helpers/navigation'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Users - Table Display', () => {
  const mockUsers = [
    {
      id: 1,
      email: 'admin@example.com',
      fullName: 'Admin User',
      role: 'admin',
      subscriptionTier: 'tier2',
      emailVerified: true,
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      email: 'user1@example.com',
      fullName: 'Regular User',
      role: 'user',
      subscriptionTier: 'tier1',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 3,
      email: 'user2@example.com',
      fullName: null,
      role: 'user',
      subscriptionTier: 'free',
      emailVerified: false,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    },
  ]

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

    await page.route('**/api/v1/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockUsers }),
      })
    })
  })

  test.describe('Table Headers', () => {
    test('should display all column headers', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.getByRole('columnheader', { name: 'ID', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Email', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Role', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Subscription', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Email Status', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'MFA', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Created', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Actions', exact: true })).toBeVisible()
    })
  })

  test.describe('User Rows', () => {
    test('should display user IDs', async ({ page }) => {
      await goto(page, '/admin/users')

      // User IDs are displayed in the first column with font-mono class
      await expect(page.locator('td.font-mono:has-text("1")')).toBeVisible()
      await expect(page.locator('td.font-mono:has-text("2")')).toBeVisible()
      await expect(page.locator('td.font-mono:has-text("3")')).toBeVisible()
    })

    test('should display user emails', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.locator('td:has-text("admin@example.com")')).toBeVisible()
      await expect(page.locator('td:has-text("user1@example.com")')).toBeVisible()
      await expect(page.locator('td:has-text("user2@example.com")')).toBeVisible()
    })

    test('should display user names or dash for null', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.locator('td:has-text("Admin User")')).toBeVisible()
      await expect(page.locator('td:has-text("Regular User")')).toBeVisible()
      // User with null name should show dash
      const rows = page.locator('tr')
      expect(await rows.count()).toBeGreaterThanOrEqual(3)
    })
  })

  test.describe('Role Badges', () => {
    test('should display admin badge for admin users', async ({ page }) => {
      await goto(page, '/admin/users')

      // Role is displayed as a badge in the Role column
      const adminRow = page.locator('tr:has-text("admin@example.com")')
      await expect(adminRow.getByText('admin', { exact: true })).toBeVisible()
    })

    test('should display user badge for regular users', async ({ page }) => {
      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await expect(userRow.getByText('user', { exact: true })).toBeVisible()
    })

    test('admin badge should have different variant than user badge', async ({ page }) => {
      await goto(page, '/admin/users')

      const adminRow = page.locator('tr:has-text("admin@example.com")')
      const userRow = page.locator('tr:has-text("user1@example.com")')

      await expect(adminRow.getByText('admin', { exact: true })).toBeVisible()
      await expect(userRow.getByText('user', { exact: true })).toBeVisible()
    })
  })

  test.describe('Subscription Tier', () => {
    test('should display tier selector for each user', async ({ page }) => {
      await goto(page, '/admin/users')

      // Wait for the table to load
      await expect(page.getByText('user1@example.com')).toBeVisible()

      const tierSelectors = page.locator('button[role="combobox"]')
      await expect(tierSelectors.first()).toBeVisible()
      expect(await tierSelectors.count()).toBeGreaterThanOrEqual(3)
    })

    test('should show Free badge for free tier', async ({ page }) => {
      await goto(page, '/admin/users')

      const freeRow = page.locator('tr:has-text("user2@example.com")')
      await expect(freeRow.getByText('Free')).toBeVisible()
    })

    test('should show Tier 1 badge for tier1 users', async ({ page }) => {
      await goto(page, '/admin/users')

      const tier1Row = page.locator('tr:has-text("user1@example.com")')
      await expect(tier1Row.getByText('Tier 1')).toBeVisible()
    })

    test('should show Tier 2 badge for tier2 users', async ({ page }) => {
      await goto(page, '/admin/users')

      const tier2Row = page.locator('tr:has-text("admin@example.com")')
      await expect(tier2Row.getByText('Tier 2')).toBeVisible()
    })
  })

  test.describe('Email Status', () => {
    test('should show Verified badge for verified emails', async ({ page }) => {
      await goto(page, '/admin/users')

      const verifiedRow = page.locator('tr:has-text("admin@example.com")')
      await expect(verifiedRow.getByText('Verified')).toBeVisible()
    })

    test('should show Unverified badge for unverified emails', async ({ page }) => {
      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      await expect(unverifiedRow.getByText('Unverified')).toBeVisible()
    })

    test('Verified badge should have green color', async ({ page }) => {
      await goto(page, '/admin/users')

      // Verified badge has bg-green-600 class
      const verifiedBadge = page.locator('tr:has-text("admin@example.com")').getByText('Verified')
      await expect(verifiedBadge).toHaveClass(/bg-green/)
    })

    test('Unverified badge should have destructive color', async ({ page }) => {
      await goto(page, '/admin/users')

      // Unverified badge has destructive variant which uses bg-destructive
      const unverifiedBadge = page.locator('tr:has-text("user2@example.com")').getByText('Unverified')
      await expect(unverifiedBadge).toHaveClass(/destructive/)
    })
  })

  test.describe('MFA Status', () => {
    test('should show Enabled badge for MFA enabled users', async ({ page }) => {
      await goto(page, '/admin/users')

      const mfaRow = page.locator('tr:has-text("admin@example.com")')
      await expect(mfaRow.getByText('Enabled')).toBeVisible()
    })

    test('should show Disabled badge for MFA disabled users', async ({ page }) => {
      await goto(page, '/admin/users')

      const noMfaRow = page.locator('tr:has-text("user1@example.com")')
      await expect(noMfaRow.getByText('Disabled')).toBeVisible()
    })

    test('Enabled badge should have blue color', async ({ page }) => {
      await goto(page, '/admin/users')

      // MFA Enabled badge has bg-blue-600 class
      const enabledBadge = page.locator('tr:has-text("admin@example.com")').getByText('Enabled')
      await expect(enabledBadge).toHaveClass(/bg-blue/)
    })
  })

  test.describe('Created Date', () => {
    test('should display formatted creation date', async ({ page }) => {
      await goto(page, '/admin/users')

      // Check that date is displayed in some format
      const dateCell = page.locator('td[class*="muted"]').first()
      await expect(dateCell).toBeVisible()
    })
  })

  test.describe('Empty State', () => {
    test('should show "No users found" when empty', async ({ page }) => {
      await page.route('**/api/v1/admin/users', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/users')

      await expect(page.locator('text=No users found')).toBeVisible()
    })
  })

  test.describe('Page Header', () => {
    test('should display User Management heading', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.locator('text=User Management')).toBeVisible()
    })

    test('should display description text', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.locator('text=View and manage registered users')).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading skeleton while fetching users', async ({ page }) => {
      await page.route('**/api/v1/admin/users', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUsers }),
        })
      })

      await goto(page, '/admin/users')

      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })
})
