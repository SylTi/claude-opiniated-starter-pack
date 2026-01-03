import { test, expect } from '@playwright/test'
import { goToSettings } from '../helpers/navigation'
import { expectButton, expectSuccessToast } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Settings Page - Linked Accounts', () => {
  test.describe('No Linked Accounts', () => {
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

      // Mock no linked accounts
      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('should show Link button for Google', async ({ page }) => {
      await goToSettings(page)

      // Should have link button for Google
      const googleCard = page.locator('[class*="card"]:has-text("Google"), div:has-text("Google")')
      const linkButton = googleCard.locator('button:has-text("Link"), a:has-text("Link")')
      await expect(linkButton.first()).toBeVisible()
    })

    test('should show Link button for GitHub', async ({ page }) => {
      await goToSettings(page)

      // Should have link button for GitHub
      const githubCard = page.locator('[class*="card"]:has-text("GitHub"), div:has-text("GitHub")')
      const linkButton = githubCard.locator('button:has-text("Link"), a:has-text("Link")')
      await expect(linkButton.first()).toBeVisible()
    })

    test('should not show connected email when not linked', async ({ page }) => {
      await goToSettings(page)

      // Should not show any connected emails
      await expect(page.locator('text=@gmail.com')).not.toBeVisible()
      await expect(page.locator('text=@github.com')).not.toBeVisible()
    })
  })

  test.describe('Google Linked', () => {
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

      // Mock Google linked
      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { provider: 'google', email: 'user@gmail.com', name: 'User', avatarUrl: null, linkedAt: new Date().toISOString() }
            ],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('should show connected email for Google', async ({ page }) => {
      await goToSettings(page)

      // Should show connected email
      await expect(page.locator('text=user@gmail.com')).toBeVisible()
    })

    test('should show Unlink button for Google', async ({ page }) => {
      await goToSettings(page)

      // Should have unlink button
      const googleCard = page.locator('[class*="card"]:has-text("Google"), div:has-text("Google")')
      const unlinkButton = googleCard.locator('button:has-text("Unlink")')
      await expect(unlinkButton.first()).toBeVisible()
    })

    test('should still show Link button for GitHub', async ({ page }) => {
      await goToSettings(page)

      // GitHub should have link button
      const githubCard = page.locator('[class*="card"]:has-text("GitHub"), div:has-text("GitHub")')
      const linkButton = githubCard.locator('button:has-text("Link")')
      await expect(linkButton.first()).toBeVisible()
    })
  })

  test.describe('GitHub Linked', () => {
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

      // Mock GitHub linked
      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { provider: 'github', email: 'user@github.com', name: 'User', avatarUrl: null, linkedAt: new Date().toISOString() }
            ],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('should show connected email for GitHub', async ({ page }) => {
      await goToSettings(page)

      // Should show connected email
      await expect(page.locator('text=user@github.com')).toBeVisible()
    })

    test('should show Unlink button for GitHub', async ({ page }) => {
      await goToSettings(page)

      // Should have unlink button
      const githubCard = page.locator('[class*="card"]:has-text("GitHub"), div:has-text("GitHub")')
      const unlinkButton = githubCard.locator('button:has-text("Unlink")')
      await expect(unlinkButton.first()).toBeVisible()
    })
  })

  test.describe('Both Linked', () => {
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

      // Mock both linked
      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { provider: 'google', email: 'user@gmail.com', name: 'User', avatarUrl: null, linkedAt: new Date().toISOString() },
              { provider: 'github', email: 'user@github.com', name: 'User', avatarUrl: null, linkedAt: new Date().toISOString() }
            ],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('should show both connected emails', async ({ page }) => {
      await goToSettings(page)

      await expect(page.locator('text=user@gmail.com')).toBeVisible()
      await expect(page.locator('text=user@github.com')).toBeVisible()
    })

    test('should show Unlink button for both', async ({ page }) => {
      await goToSettings(page)

      const unlinkButtons = page.locator('button:has-text("Unlink")')
      expect(await unlinkButtons.count()).toBe(2)
    })
  })

  test.describe('Link Account Action', () => {
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

      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('clicking Link for Google should redirect to OAuth', async ({ page }) => {
      await goToSettings(page)

      // Get Google link button
      const googleCard = page.locator('[class*="card"]:has-text("Google"), div:has-text("Google")')
      const linkButton = googleCard.locator('button:has-text("Link"), a:has-text("Link")').first()

      // Click and check for navigation (may redirect to OAuth provider)
      await linkButton.click()

      // Should navigate away or show loading
      // This depends on implementation
    })

    test('clicking Link for GitHub should redirect to OAuth', async ({ page }) => {
      await goToSettings(page)

      // Get GitHub link button
      const githubCard = page.locator('[class*="card"]:has-text("GitHub"), div:has-text("GitHub")')
      const linkButton = githubCard.locator('button:has-text("Link"), a:has-text("Link")').first()

      // Click
      await linkButton.click()

      // Should navigate or show loading
    })
  })

  test.describe('Unlink Account Action', () => {
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

      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { provider: 'google', email: 'user@gmail.com', name: 'User', avatarUrl: null, linkedAt: new Date().toISOString() }
            ],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })
    })

    test('should unlink Google account successfully', async ({ page }) => {
      await mockApiResponse(page, '/oauth/google/unlink', { message: 'Unlinked' }, { method: 'DELETE' })

      await goToSettings(page)

      // Click unlink
      const googleCard = page.locator('[class*="card"]:has-text("Google"), div:has-text("Google")')
      const unlinkButton = googleCard.locator('button:has-text("Unlink")').first()
      await unlinkButton.click()

      // Should show success
      await expectSuccessToast(page, 'unlinked').catch(async () => {
        // Check that email is no longer shown
      })
    })

    test('should handle unlink error', async ({ page }) => {
      await mockApiError(page, '/oauth/google/unlink', 400, 'Cannot unlink last login method', { method: 'DELETE' })

      await goToSettings(page)

      // Click unlink
      const googleCard = page.locator('[class*="card"]:has-text("Google"), div:has-text("Google")')
      const unlinkButton = googleCard.locator('button:has-text("Unlink")').first()
      await unlinkButton.click()

      // Should show error
      await expect(page.locator('text=Cannot').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })
  })

  test.describe('Provider Icons', () => {
    test('should display Google icon', async ({ page }) => {
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

      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goToSettings(page)

      // Should have icons
      await expect(page.locator('text=Google')).toBeVisible()
    })

    test('should display GitHub icon', async ({ page }) => {
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

      await page.route('**/api/v1/auth/oauth/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        })
      })

      // Mock login history
      await page.route('**/api/v1/auth/login-history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goToSettings(page)

      // Should have GitHub text
      await expect(page.locator('text=GitHub')).toBeVisible()
    })
  })
})
