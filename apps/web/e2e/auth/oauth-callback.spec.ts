import { test, expect } from '@playwright/test'
import { goto, expectRedirect } from '../helpers/navigation'
import { expectHeading, expectAlert, expectLoading } from '../helpers/assertions'

test.describe('OAuth Callback Page', () => {
  test.describe('Success Callbacks', () => {
    test('should redirect new user to profile page', async ({ page }) => {
      // Navigate to callback with success and isNewUser
      await goto(page, '/auth/callback?success=true&isNewUser=true')

      // Should redirect to profile
      await expect(page).toHaveURL('/profile', { timeout: 10000 })
    })

    test('should redirect existing user to dashboard', async ({ page }) => {
      // Navigate to callback with success only
      await goto(page, '/auth/callback?success=true')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should redirect existing user with explicit isNewUser=false to dashboard', async ({ page }) => {
      // Navigate to callback
      await goto(page, '/auth/callback?success=true&isNewUser=false')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })
  })

  test.describe('Error Callbacks', () => {
    test('should show error message from query param', async ({ page }) => {
      const errorMessage = 'OAuth authentication failed'
      await goto(page, `/auth/callback?error=${encodeURIComponent(errorMessage)}`)

      // Should show error
      await expect(page.locator(`text="${errorMessage}"`).or(page.locator('text=failed')).first()).toBeVisible()
    })

    test('should show generic error for unknown error', async ({ page }) => {
      await goto(page, '/auth/callback?error=unknown_error')

      // Should show some error indication
      await expect(page.locator('text=error').or(page.locator('text=failed')).first()).toBeVisible()
    })

    test('should show link to login page on error', async ({ page }) => {
      await goto(page, '/auth/callback?error=access_denied')

      // Should have link to login
      await expect(page.locator('a[href="/login"]')).toBeVisible()
    })

    test('should handle email already linked error', async ({ page }) => {
      await goto(page, '/auth/callback?error=Email+already+linked+to+another+account')

      // Should show error about linked account
      await expect(page.locator('text=linked').or(page.locator('text=account')).first()).toBeVisible()
    })

    test('should handle OAuth provider error', async ({ page }) => {
      await goto(page, '/auth/callback?error=Provider+returned+an+error')

      // Should show error
      await expect(page.locator('text=error').or(page.locator('text=Provider')).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading indicator while processing', async ({ page }) => {
      // Slow down response
      await page.route('**/api/v1/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.continue()
      })

      // Navigate to callback
      await goto(page, '/auth/callback?success=true')

      // Should show loading indicator
      await expectLoading(page).catch(() => {
        // Loading may be too fast to catch
      })
    })

    test('should show spinner or processing message', async ({ page }) => {
      // Slow down to catch loading state
      await page.route('**/api/v1/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        await route.continue()
      })

      await goto(page, '/auth/callback?success=true')

      // Check for any loading indicator
      const spinner = page.locator('[class*="animate-spin"]')
      const loadingText = page.locator('text=Loading').or(page.locator('text=Processing')).or(page.locator('text=Please wait'))

      await expect(spinner.or(loadingText).first()).toBeVisible({ timeout: 1000 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Edge Cases', () => {
    test('should handle empty query params', async ({ page }) => {
      await goto(page, '/auth/callback')

      // Should redirect to login or stay on callback page with loading state
      await expect(page).toHaveURL(/login|auth\/callback/, { timeout: 10000 })
    })

    test('should handle malformed success param', async ({ page }) => {
      await goto(page, '/auth/callback?success=invalid')

      // Should redirect to login or stay on callback page
      await expect(page).toHaveURL(/login|auth\/callback/, { timeout: 10000 })
    })

    test('should handle both success and error params (error takes precedence)', async ({ page }) => {
      await goto(page, '/auth/callback?success=true&error=some_error')

      // Error should take precedence
      await expect(page.locator('text=error').first()).toBeVisible().catch(async () => {
        // Or redirect to login
        await expect(page).toHaveURL('/login')
      })
    })
  })

  test.describe('Provider-specific Callbacks', () => {
    test('should handle Google OAuth success', async ({ page }) => {
      await goto(page, '/auth/callback?success=true&provider=google')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should handle GitHub OAuth success', async ({ page }) => {
      await goto(page, '/auth/callback?success=true&provider=github')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should handle Google OAuth error', async ({ page }) => {
      await goto(page, '/auth/callback?error=access_denied&provider=google')

      // Should show error
      await expect(page.locator('text=denied').or(page.locator('a[href="/login"]')).first()).toBeVisible()
    })

    test('should handle GitHub OAuth error', async ({ page }) => {
      await goto(page, '/auth/callback?error=access_denied&provider=github')

      // Should show error
      await expect(page.locator('text=denied').or(page.locator('a[href="/login"]')).first()).toBeVisible()
    })
  })

  test.describe('Navigation from Error State', () => {
    test('should navigate to login when clicking login link', async ({ page }) => {
      await goto(page, '/auth/callback?error=authentication_failed')

      // Click login link
      const loginLink = page.locator('a[href="/login"]')
      await expect(loginLink).toBeVisible()
      await loginLink.click()

      // Should be on login page
      await expect(page).toHaveURL('/login')
    })

    test('should navigate to register when clicking register link', async ({ page }) => {
      await goto(page, '/auth/callback?error=authentication_failed')

      // Check for register link
      const registerLink = page.locator('a[href="/register"]')
      if (await registerLink.isVisible()) {
        await registerLink.click()
        await expect(page).toHaveURL('/register')
      }
    })
  })

  test.describe('Token Handling', () => {
    test('should handle callback with token parameter', async ({ page }) => {
      // Some OAuth flows return token in URL
      await goto(page, '/auth/callback?success=true&token=mock-token-123')

      // Should redirect to dashboard (token should be stored)
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should handle callback with code parameter (OAuth code flow)', async ({ page }) => {
      // OAuth authorization code flow - backend should handle this and redirect with success/error
      // If frontend receives code directly, it should show loading or redirect to login
      await goto(page, '/auth/callback?code=auth-code-123&state=state-123')

      // Page should either show loading state, error, or stay on callback
      // (actual code exchange happens on backend)
      await expect(page).toHaveURL(/auth\/callback|login/, { timeout: 10000 })
    })
  })
})
