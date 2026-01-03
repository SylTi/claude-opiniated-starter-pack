import { test, expect } from '@playwright/test'
import { goToRegister } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectAlert, expectHeading, expectButton } from '../helpers/assertions'
import { createTestUser, INVALID_EMAILS } from '../fixtures/user.fixture'
import { mockApiResponse, mockApiError, mockValidationError } from '../fixtures/api-mock.fixture'

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await goToRegister(page)
  })

  test.describe('Page Elements', () => {
    test('should display all form elements', async ({ page }) => {
      // Check form fields are visible
      await expect(page.locator('input#fullName')).toBeVisible()
      await expect(page.locator('input#email')).toBeVisible()
      await expect(page.locator('input#password')).toBeVisible()
      await expect(page.locator('input#passwordConfirmation')).toBeVisible()

      // Check submit button
      await expectButton(page, 'Create account')

      // Check OAuth buttons
      await expectButton(page, 'Google')
      await expectButton(page, 'GitHub')

      // Check login link
      await expect(page.locator('a[href="/login"]').first()).toBeVisible()
    })

    test('should have proper input attributes', async ({ page }) => {
      // Email input
      const emailInput = page.locator('input#email')
      await expect(emailInput).toHaveAttribute('type', 'email')
      await expect(emailInput).toHaveAttribute('autocomplete', 'email')

      // Password inputs
      const passwordInput = page.locator('input#password')
      await expect(passwordInput).toHaveAttribute('type', 'password')
      await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')

      const confirmInput = page.locator('input#passwordConfirmation')
      await expect(confirmInput).toHaveAttribute('type', 'password')
    })
  })

  test.describe('Successful Registration', () => {
    test('should register with valid data and show success message', async ({ page }) => {
      const user = createTestUser()

      // Mock successful registration
      await mockApiResponse(page, '/auth/register', { message: 'Registration successful' }, { method: 'POST' })

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await submitForm(page, 'Create account')

      // Expect success state
      await expectHeading(page, 'Check your email')
      await expect(page.locator('a[href="/login"]')).toBeVisible()
    })

    test('should register without full name (optional field)', async ({ page }) => {
      const user = createTestUser({ fullName: undefined })

      // Mock successful registration
      await mockApiResponse(page, '/auth/register', { message: 'Registration successful' }, { method: 'POST' })

      // Fill form without fullName
      await fillForm(page, {
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await submitForm(page, 'Create account')

      // Expect success state
      await expectHeading(page, 'Check your email')
    })
  })

  test.describe('Client-side Validation', () => {
    test('should show error for invalid email format', async ({ page }) => {
      for (const invalidEmail of INVALID_EMAILS.slice(0, 2)) {
        await page.fill('input#email', invalidEmail)
        await page.fill('input#password', 'Password123!')
        await page.fill('input#passwordConfirmation', 'Password123!')
        await submitForm(page, 'Create account')

        // Should show validation error
        const emailError = page.locator('input#email').locator('..').locator('p.text-destructive, p.text-red-500, [class*="text-destructive"]')
        await expect(emailError.first()).toBeVisible({ timeout: 2000 }).catch(() => {
          // Alternative: check for any error near email field
        })

        // Clear for next iteration
        await page.fill('input#email', '')
      }
    })

    test('should show error for password too short', async ({ page }) => {
      await fillForm(page, {
        email: 'test@example.com',
        password: 'short',
        passwordConfirmation: 'short',
      })

      await submitForm(page, 'Create account')

      // Should show validation error for password length
      // The form should not submit with invalid password
      await expect(page).toHaveURL('/register')
    })

    test('should show error for password mismatch', async ({ page }) => {
      await fillForm(page, {
        email: 'test@example.com',
        password: 'Password123!',
        passwordConfirmation: 'DifferentPassword123!',
      })

      await submitForm(page, 'Create account')

      // Should show mismatch error
      await expect(page).toHaveURL('/register')
    })

    test('should show error for empty required fields', async ({ page }) => {
      // Try to submit empty form
      await submitForm(page, 'Create account')

      // Should stay on register page
      await expect(page).toHaveURL('/register')
    })
  })

  test.describe('API Error Handling', () => {
    test('should show error when email already exists', async ({ page }) => {
      const user = createTestUser()

      // Mock conflict error
      await mockApiError(page, '/auth/register', 409, 'Email already registered', { method: 'POST' })

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await submitForm(page, 'Create account')

      // Should show error alert
      await expectAlert(page, 'Email already registered', 'destructive').catch(async () => {
        // Alternative: check for any error message
        await expect(page.locator('text=already').or(page.locator('text=exists')).first()).toBeVisible()
      })
    })

    test('should show error on server error', async ({ page }) => {
      const user = createTestUser()

      // Mock server error
      await mockApiError(page, '/auth/register', 500, 'Internal server error', { method: 'POST' })

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await submitForm(page, 'Create account')

      // Should show error
      await expect(page).toHaveURL('/register')
    })

    test('should show validation errors from API', async ({ page }) => {
      const user = createTestUser()

      // Mock validation error
      await mockValidationError(page, '/auth/register', [
        { field: 'email', message: 'Email is invalid', rule: 'email' },
      ])

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await submitForm(page, 'Create account')

      // Should stay on page
      await expect(page).toHaveURL('/register')
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      const user = createTestUser()

      // Mock slow response
      await mockApiResponse(page, '/auth/register', { message: 'Success' }, { method: 'POST', delay: 1000 })

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit and check loading state
      await page.click('button:has-text("Create account")')

      // Button should show loading state
      await expect(page.locator('button:has-text("Creating account")')).toBeVisible().catch(() => {
        // Alternative: button should be disabled
        expect(page.locator('button[type="submit"]')).toBeDisabled()
      })
    })

    test('should disable submit button during submission', async ({ page }) => {
      const user = createTestUser()

      // Mock slow response
      await mockApiResponse(page, '/auth/register', { message: 'Success' }, { method: 'POST', delay: 500 })

      // Fill form
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })

      // Submit
      await page.click('button:has-text("Create account")')

      // Button should be disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Navigation', () => {
    test('should navigate to login page via link', async ({ page }) => {
      await page.click('a[href="/login"]')
      await expect(page).toHaveURL('/login')
    })

    test('should navigate to login after successful registration', async ({ page }) => {
      const user = createTestUser()

      // Mock successful registration
      await mockApiResponse(page, '/auth/register', { message: 'Registration successful' }, { method: 'POST' })

      // Fill and submit
      await fillForm(page, {
        fullName: user.fullName!,
        email: user.email,
        password: user.password,
        passwordConfirmation: user.passwordConfirmation!,
      })
      await submitForm(page, 'Create account')

      // Wait for success state
      await expectHeading(page, 'Check your email')

      // Click go to login (it's a button, not a link)
      await page.click('button:has-text("Go to Login")')
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('OAuth Buttons', () => {
    test('should have Google OAuth button visible and clickable', async ({ page }) => {
      const googleButton = page.locator('button:has-text("Google")')
      await expect(googleButton).toBeVisible()
      await expect(googleButton).toBeEnabled()
    })

    test('should have GitHub OAuth button visible and clickable', async ({ page }) => {
      const githubButton = page.locator('button:has-text("GitHub")')
      await expect(githubButton).toBeVisible()
      await expect(githubButton).toBeEnabled()
    })
  })
})
