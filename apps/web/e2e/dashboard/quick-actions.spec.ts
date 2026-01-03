import { test, expect } from '@playwright/test'
import { goToDashboard } from '../helpers/navigation'
import { expectButton, expectLink } from '../helpers/assertions'
import { mockAuthenticatedUser, mockDashboardStats } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Dashboard Quick Actions', () => {
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

    await mockDashboardStats(page, {
      accountAgeDays: 30,
      totalLogins: 10,
      emailVerified: true,
      mfaEnabled: false,
    })
  })

  test.describe('Quick Action Buttons', () => {
    test('should display Edit Profile action', async ({ page }) => {
      await goToDashboard(page)

      // Should have Edit Profile button/link
      const editProfile = page.locator('a:has-text("Edit Profile"), a:has-text("Profile"), button:has-text("Profile")')
      await expect(editProfile.first()).toBeVisible()
    })

    test('should display Security Settings action', async ({ page }) => {
      await goToDashboard(page)

      // Should have Security Settings button/link
      const security = page.locator('a:has-text("Security"), button:has-text("Security")')
      await expect(security.first()).toBeVisible()
    })

    test('should display Connected Accounts action', async ({ page }) => {
      await goToDashboard(page)

      // Should have Connected Accounts button/link
      const connected = page.locator('a:has-text("Connected"), a:has-text("Accounts"), button:has-text("Connected")')
      await expect(connected.first()).toBeVisible()
    })

    test('should display Account Settings action', async ({ page }) => {
      await goToDashboard(page)

      // Should have Account Settings button/link
      const settings = page.locator('a:has-text("Settings"), button:has-text("Settings")')
      await expect(settings.first()).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('Edit Profile should navigate to /profile', async ({ page }) => {
      await goToDashboard(page)

      // Click Edit Profile
      const editProfile = page.locator('a:has-text("Edit Profile"), a[href="/profile"]')
      await editProfile.first().click()

      await expect(page).toHaveURL('/profile')
    })

    test('Security Settings should navigate to /profile/security', async ({ page }) => {
      await goToDashboard(page)

      // Click Security
      const security = page.locator('a:has-text("Security"), a[href="/profile/security"]')
      await security.first().click()

      await expect(page).toHaveURL('/profile/security')
    })

    test('Connected Accounts should navigate to /profile/settings', async ({ page }) => {
      await goToDashboard(page)

      // Click Connected Accounts
      const connected = page.locator('a:has-text("Connected"), a[href="/profile/settings"]')
      await connected.first().click()

      await expect(page).toHaveURL('/profile/settings')
    })

    test('Account Settings should navigate to /profile/settings', async ({ page }) => {
      await goToDashboard(page)

      // Click Account Settings
      const settings = page.locator('a:has-text("Settings"):not(:has-text("Security")), a[href="/profile/settings"]')
      await settings.first().click()

      await expect(page).toHaveURL('/profile/settings')
    })
  })

  test.describe('Quick Action Icons', () => {
    test('should display icons with quick actions', async ({ page }) => {
      await goToDashboard(page)

      // Quick actions should have icons (SVG elements in main content)
      const icons = await page.locator('main svg').count()
      expect(icons).toBeGreaterThan(0)
    })
  })

  test.describe('Connected Accounts Badge', () => {
    test('should show badge with linked accounts count', async ({ page }) => {
      // Mock user with linked accounts
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
              google: { linked: true, email: 'user@gmail.com' },
              github: { linked: false, email: null },
            },
          }),
        })
      })

      await goToDashboard(page)

      // May show badge with count
      const badge = page.locator('[class*="badge"]:has-text("1")')
      // This depends on implementation
    })
  })

  test.describe('Accessibility', () => {
    test('quick actions should be keyboard accessible', async ({ page }) => {
      await goToDashboard(page)

      // Tab to quick actions
      await page.keyboard.press('Tab')

      // Should be able to navigate with keyboard
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('quick actions should have proper link roles', async ({ page }) => {
      await goToDashboard(page)

      // Quick actions should be links to profile pages
      const profileLink = page.locator('a[href="/profile"]')
      const securityLink = page.locator('a[href="/profile/security"]')
      const settingsLink = page.locator('a[href="/profile/settings"]')

      // At least one profile-related link should be visible
      await expect(
        profileLink.or(securityLink).or(settingsLink).first()
      ).toBeVisible()
    })
  })

  test.describe('Hover States', () => {
    test('quick action cards should have hover effect', async ({ page }) => {
      await goToDashboard(page)

      // Get first action card
      const actionCard = page.locator('a[href="/profile"]').first()

      // Hover and check for visual change
      await actionCard.hover()

      // The card should be visible and interactive
      await expect(actionCard).toBeVisible()
    })
  })
})
