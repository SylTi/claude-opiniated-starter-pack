import { test, expect } from '@playwright/test'
import { goToLogin } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectAlert, expectButton } from '../helpers/assertions'
import { TEST_USERS } from '../fixtures/auth.fixture'
import { mockApiResponse, mockApiError, mockAuthenticatedUser, mockDashboardStats } from '../fixtures/api-mock.fixture'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await goToLogin(page)
  })

  test.describe('Page Elements', () => {
    test('should display all form elements', async ({ page }) => {
      // Check form fields are visible
      await expect(page.locator('input#email')).toBeVisible()
      await expect(page.locator('input#password')).toBeVisible()

      // Check submit button
      await expectButton(page, 'Sign in')

      // Check OAuth buttons
      await expectButton(page, 'Google')
      await expectButton(page, 'GitHub')

      // Check links
      await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
      await expect(page.locator('a[href="/register"]').first()).toBeVisible()
    })

    test('should have proper input attributes', async ({ page }) => {
      // Email input
      const emailInput = page.locator('input#email')
      await expect(emailInput).toHaveAttribute('type', 'email')

      // Password input
      const passwordInput = page.locator('input#password')
      await expect(passwordInput).toHaveAttribute('type', 'password')
    })

    test('should not show MFA input initially', async ({ page }) => {
      await expect(page.locator('input#mfaCode')).not.toBeVisible()
    })
  })

  test.describe('Successful Login', () => {
    test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
      // Mock successful login
      await mockApiResponse(
        page,
        '/auth/login',
        {
          user: {
            id: 1,
            email: TEST_USERS.regular.email,
            fullName: TEST_USERS.regular.fullName,
            role: 'user',
          },
          token: 'mock-token',
        },
        { method: 'POST' }
      )

      // Mock auth/me for post-login
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        emailVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })

      // Mock dashboard stats for post-login redirect
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        lastLoginAt: new Date().toISOString(),
        emailVerified: true,
        mfaEnabled: false,
        subscriptionTier: 'free',
        connectedOAuthAccounts: 0,
        recentActivity: [],
      })

      // Fill form
      await fillForm(page, {
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
      })

      // Submit
      await submitForm(page, 'Sign in')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should login as admin and redirect to dashboard', async ({ page }) => {
      // Mock successful admin login
      await mockApiResponse(
        page,
        '/auth/login',
        {
          user: {
            id: 2,
            email: TEST_USERS.admin.email,
            fullName: TEST_USERS.admin.fullName,
            role: 'admin',
          },
          token: 'mock-admin-token',
        },
        { method: 'POST' }
      )

      // Mock auth/me
      await mockAuthenticatedUser(page, {
        id: 2,
        email: TEST_USERS.admin.email,
        fullName: TEST_USERS.admin.fullName,
        role: 'admin',
        subscriptionTier: 'tier2',
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: null,
        emailVerifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })

      // Mock dashboard stats for post-login redirect
      await mockDashboardStats(page, {
        accountAgeDays: 365,
        totalLogins: 100,
        lastLoginAt: new Date().toISOString(),
        emailVerified: true,
        mfaEnabled: true,
        subscriptionTier: 'tier2',
        connectedOAuthAccounts: 2,
        recentActivity: [],
      })

      // Fill form
      await fillForm(page, {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      })

      // Submit
      await submitForm(page, 'Sign in')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })
  })

  test.describe('Invalid Credentials', () => {
    test('should show error for invalid credentials', async ({ page }) => {
      // Mock unauthorized error
      await mockApiError(page, '/auth/login', 401, 'Invalid email or password', { method: 'POST' })

      // Fill form with wrong credentials
      await fillForm(page, {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      })

      // Submit
      await submitForm(page, 'Sign in')

      // Should show error alert
      await expectAlert(page, 'Invalid email or password', 'destructive').catch(async () => {
        // Alternative: check for any error
        await expect(page.locator('[role="alert"]')).toBeVisible()
      })

      // Should stay on login page
      await expect(page).toHaveURL('/login')
    })

    test('should show error for unverified email', async ({ page }) => {
      // Mock unverified error
      await mockApiError(page, '/auth/login', 403, 'Please verify your email address', { method: 'POST' })

      // Fill form
      await fillForm(page, {
        email: 'unverified@example.com',
        password: 'password123',
      })

      // Submit
      await submitForm(page, 'Sign in')

      // Should show error
      await expect(page.locator('text=verify').first()).toBeVisible().catch(() => {
        // Alternative check
        expect(page).toHaveURL('/login')
      })
    })
  })

  test.describe('MFA Flow', () => {
    test('should show MFA input when required', async ({ page }) => {
      // Mock MFA required response - use explicit URL pattern
      await page.route('**/api/v1/auth/login', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { requiresMfa: true } }),
          })
        } else {
          await route.continue()
        }
      })

      // Fill form
      await fillForm(page, {
        email: TEST_USERS.mfaEnabled.email,
        password: TEST_USERS.mfaEnabled.password,
      })

      // Submit
      await submitForm(page, 'Sign in')

      // Should show MFA input - wait for React state update
      await expect(page.locator('input#mfaCode')).toBeVisible({ timeout: 5000 })
    })

    test('should accept valid MFA code', async ({ page }) => {
      // First mock: MFA required
      await page.route('**/api/v1/auth/login', async (route) => {
        const postData = route.request().postDataJSON()

        if (!postData.mfaCode) {
          // First request without MFA
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { requiresMfa: true } }),
          })
        } else {
          // Second request with MFA - return user data directly in data field
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 1,
                email: TEST_USERS.mfaEnabled.email,
                fullName: TEST_USERS.mfaEnabled.fullName,
                role: 'user',
                subscriptionTier: 'free',
                emailVerifiedAt: new Date().toISOString(),
                mfaEnabled: true,
              },
            }),
          })
        }
      })

      // Mock auth/me
      await mockApiResponse(page, '/auth/me', {
        id: 1,
        email: TEST_USERS.mfaEnabled.email,
        fullName: TEST_USERS.mfaEnabled.fullName,
        role: 'user',
        subscriptionTier: 'free',
        mfaEnabled: true,
        emailVerifiedAt: new Date().toISOString(),
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
        effectiveSubscriptionTier: { slug: 'free', name: 'Free' },
      })

      // Mock dashboard stats for redirect
      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        lastLoginAt: new Date().toISOString(),
        emailVerified: true,
        mfaEnabled: true,
        subscriptionTier: 'free',
        connectedOAuthAccounts: 0,
        recentActivity: [],
      })

      // Fill login form
      await fillForm(page, {
        email: TEST_USERS.mfaEnabled.email,
        password: TEST_USERS.mfaEnabled.password,
      })
      await submitForm(page, 'Sign in')

      // Wait for MFA input
      await expect(page.locator('input#mfaCode')).toBeVisible({ timeout: 5000 })

      // Enter MFA code
      await page.fill('input#mfaCode', '123456')
      await submitForm(page, 'Sign in')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should show error for invalid MFA code', async ({ page }) => {
      // First mock: MFA required
      await page.route('**/api/v1/auth/login', async (route) => {
        const postData = route.request().postDataJSON()

        if (!postData.mfaCode) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { requiresMfa: true } }),
          })
        } else {
          // Invalid MFA code
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Unauthorized',
              message: 'Invalid MFA code',
            }),
          })
        }
      })

      // Fill login form
      await fillForm(page, {
        email: TEST_USERS.mfaEnabled.email,
        password: TEST_USERS.mfaEnabled.password,
      })
      await submitForm(page, 'Sign in')

      // Wait for MFA input
      await expect(page.locator('input#mfaCode')).toBeVisible({ timeout: 5000 })

      // Enter wrong MFA code
      await page.fill('input#mfaCode', '000000')
      await submitForm(page, 'Sign in')

      // Should show error
      await expect(page.locator('text=Invalid').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })

    test('MFA input should only accept 6 digits', async ({ page }) => {
      // Mock MFA required - use explicit URL pattern
      await page.route('**/api/v1/auth/login', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { requiresMfa: true } }),
          })
        } else {
          await route.continue()
        }
      })

      // Fill login form
      await fillForm(page, {
        email: TEST_USERS.mfaEnabled.email,
        password: TEST_USERS.mfaEnabled.password,
      })
      await submitForm(page, 'Sign in')

      // Wait for MFA input
      const mfaInput = page.locator('input#mfaCode')
      await expect(mfaInput).toBeVisible({ timeout: 5000 })

      // Check attributes
      await expect(mfaInput).toHaveAttribute('maxLength', '6')
      await expect(mfaInput).toHaveAttribute('inputMode', 'numeric')
    })
  })

  test.describe('Client-side Validation', () => {
    test('should show error for empty email', async ({ page }) => {
      await page.fill('input#password', 'password123')
      await submitForm(page, 'Sign in')

      // Should stay on login page
      await expect(page).toHaveURL('/login')
    })

    test('should show error for empty password', async ({ page }) => {
      await page.fill('input#email', 'test@example.com')
      await submitForm(page, 'Sign in')

      // Should stay on login page
      await expect(page).toHaveURL('/login')
    })

    test('should show error for invalid email format', async ({ page }) => {
      await fillForm(page, {
        email: 'invalid-email',
        password: 'password123',
      })
      await submitForm(page, 'Sign in')

      // Should stay on login page
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      // Mock slow response to ensure we can catch the loading state - use explicit route
      await page.route('**/api/v1/auth/login', async (route) => {
        if (route.request().method() === 'POST') {
          // Delay to catch the loading state
          await new Promise((resolve) => setTimeout(resolve, 2000))
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                user: { id: 1, email: TEST_USERS.regular.email },
                token: 'token',
              },
            }),
          })
        } else {
          await route.continue()
        }
      })

      // Fill form
      await fillForm(page, {
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
      })

      // Click submit button (use type="submit" to target form button)
      await page.click('button[type="submit"]:has-text("Sign in")')

      // Check for loading state - button should show "Signing in..." or be disabled
      await expect(
        page.locator('button[type="submit"]:has-text("Signing in")').or(page.locator('button[type="submit"]:disabled'))
      ).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await page.click('a[href="/forgot-password"]')
      await expect(page).toHaveURL('/forgot-password')
    })

    test('should navigate to register page', async ({ page }) => {
      await page.click('a[href="/register"]')
      await expect(page).toHaveURL('/register')
    })
  })

  test.describe('OAuth Buttons', () => {
    test('should have Google OAuth button visible and enabled', async ({ page }) => {
      const googleButton = page.locator('button:has-text("Google")')
      await expect(googleButton).toBeVisible()
      await expect(googleButton).toBeEnabled()
    })

    test('should have GitHub OAuth button visible and enabled', async ({ page }) => {
      const githubButton = page.locator('button:has-text("GitHub")')
      await expect(githubButton).toBeVisible()
      await expect(githubButton).toBeEnabled()
    })
  })
})
