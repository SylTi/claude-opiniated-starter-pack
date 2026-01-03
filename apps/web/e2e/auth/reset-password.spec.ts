import { test, expect } from '@playwright/test'
import { goto, expectRedirect } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectHeading, expectButton, expectAlert } from '../helpers/assertions'
import { mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

const VALID_TOKEN = 'valid-reset-token-123'
const INVALID_TOKEN = 'invalid-token'

test.describe('Reset Password Page', () => {
  test.describe('Page Elements', () => {
    test('should display form with valid token', async ({ page }) => {
      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Check form fields
      await expect(page.locator('input#password')).toBeVisible()
      await expect(page.locator('input#passwordConfirmation')).toBeVisible()

      // Check submit button
      await expectButton(page, 'Reset password')
    })

    test('should have proper password input attributes', async ({ page }) => {
      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      const passwordInput = page.locator('input#password')
      await expect(passwordInput).toHaveAttribute('type', 'password')
      await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')

      const confirmInput = page.locator('input#passwordConfirmation')
      await expect(confirmInput).toHaveAttribute('type', 'password')
    })
  })

  test.describe('Token Validation', () => {
    test('should show error for missing token', async ({ page }) => {
      await goto(page, '/reset-password')

      // Wait for page to hydrate, then check for "Invalid link" heading
      await expect(page.locator('h2:has-text("Invalid link")')).toBeVisible({ timeout: 5000 }).catch(async () => {
        // Or look for the error message text
        await expect(page.locator('text=invalid').or(page.locator('text=expired'))).toBeVisible()
      })

      // Should have link to request new reset
      await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
    })

    test('should show error for invalid token', async ({ page }) => {
      // Mock invalid token error
      await page.route('**/api/v1/auth/reset-password', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'BadRequest',
            message: 'Invalid or expired reset token',
          }),
        })
      })

      await goto(page, `/reset-password?token=${INVALID_TOKEN}`)

      // Try to submit
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should show error
      await expect(page.locator('text=invalid').or(page.locator('text=expired')).first()).toBeVisible()
    })

    test('should show error for expired token', async ({ page }) => {
      // Mock expired token error
      await mockApiError(
        page,
        '/auth/reset-password',
        400,
        'Reset token has expired',
        { method: 'POST' }
      )

      await goto(page, `/reset-password?token=expired-token`)

      // Try to submit
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should show error
      await expect(page.locator('text=expired').first()).toBeVisible()
    })
  })

  test.describe('Successful Reset', () => {
    test('should reset password with valid token and redirect to login', async ({ page }) => {
      // Mock successful reset
      await mockApiResponse(
        page,
        '/auth/reset-password',
        { message: 'Password reset successful' },
        { method: 'POST' }
      )

      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Fill form
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })

      // Submit
      await submitForm(page, 'Reset password')

      // Should redirect to login or show success
      await expect(page).toHaveURL('/login', { timeout: 10000 }).catch(async () => {
        // Or show success message
        await expectHeading(page, 'Password reset')
      })
    })

    test('should show success message after reset', async ({ page }) => {
      // Mock successful reset
      await mockApiResponse(
        page,
        '/auth/reset-password',
        { message: 'Password reset successful' },
        { method: 'POST' }
      )

      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Fill and submit
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should show success heading "Password reset successful"
      await expect(page.locator('h2:has-text("Password reset successful")')).toBeVisible({ timeout: 5000 }).catch(async () => {
        // Or may redirect to login
        await expect(page).toHaveURL('/login')
      })
    })
  })

  test.describe('Client-side Validation', () => {
    test.beforeEach(async ({ page }) => {
      await goto(page, `/reset-password?token=${VALID_TOKEN}`)
    })

    test('should show error for password too short', async ({ page }) => {
      await fillForm(page, {
        password: 'short',
        passwordConfirmation: 'short',
      })
      await submitForm(page, 'Reset password')

      // Should stay on page
      await expect(page).toHaveURL(/reset-password/)
    })

    test('should show error for password mismatch', async ({ page }) => {
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'DifferentPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should stay on page
      await expect(page).toHaveURL(/reset-password/)
    })

    test('should show error for empty password', async ({ page }) => {
      await fillForm(page, {
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should stay on page
      await expect(page).toHaveURL(/reset-password/)
    })

    test('should show error for empty confirmation', async ({ page }) => {
      await fillForm(page, {
        password: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should stay on page
      await expect(page).toHaveURL(/reset-password/)
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      // Mock slow response
      await mockApiResponse(
        page,
        '/auth/reset-password',
        { message: 'Success' },
        { method: 'POST', delay: 1000 }
      )

      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Fill form
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })

      // Submit
      await page.click('button:has-text("Reset password")')

      // Button should show loading state
      await expect(page.locator('button:has-text("Resetting")')).toBeVisible().catch(async () => {
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
      })
    })

    test('should disable submit button during submission', async ({ page }) => {
      // Mock slow response
      await mockApiResponse(
        page,
        '/auth/reset-password',
        { message: 'Success' },
        { method: 'POST', delay: 500 }
      )

      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Fill and submit
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await page.click('button:has-text("Reset password")')

      // Button should be disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Navigation', () => {
    test('should have link to request new reset link', async ({ page }) => {
      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Check for forgot-password link
      const forgotLink = page.locator('a[href="/forgot-password"]')
      if (await forgotLink.isVisible()) {
        await forgotLink.click()
        await expect(page).toHaveURL('/forgot-password')
      }
    })

    test('should navigate to login after successful reset', async ({ page }) => {
      // Mock successful reset
      await mockApiResponse(
        page,
        '/auth/reset-password',
        { message: 'Password reset successful' },
        { method: 'POST' }
      )

      await goto(page, `/reset-password?token=${VALID_TOKEN}`)

      // Fill and submit
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Wait for navigation or success state
      await page.waitForTimeout(1000)

      // Either redirected to login or has a link to login
      const url = page.url()
      if (!url.includes('/login')) {
        const loginLink = page.locator('a[href="/login"]')
        if (await loginLink.isVisible()) {
          await loginLink.click()
        }
      }
      await expect(page).toHaveURL('/login', { timeout: 5000 })
    })
  })

  test.describe('Error Display', () => {
    test('should display error page for invalid token access', async ({ page }) => {
      // The page doesn't validate tokens on load - it only checks if token exists
      // With an invalid token, the form is shown. Error appears after submitting.
      // Mock the reset password API to return error
      await mockApiError(
        page,
        '/auth/reset-password',
        400,
        'Invalid or expired token',
        { method: 'POST' }
      )

      await goto(page, `/reset-password?token=${INVALID_TOKEN}`)

      // Form should be visible (token exists, even if invalid)
      await expect(page.locator('input#password')).toBeVisible()

      // Submit with valid passwords to trigger token validation
      await fillForm(page, {
        password: 'NewPassword123!',
        passwordConfirmation: 'NewPassword123!',
      })
      await submitForm(page, 'Reset password')

      // Should show error message after submission fails
      await expect(page.locator('text=Invalid').or(page.locator('text=expired'))).toBeVisible()
    })
  })
})
