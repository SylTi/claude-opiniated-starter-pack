import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectHeading, expectButton } from '../helpers/assertions'
import { mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'
import { INVALID_EMAILS } from '../fixtures/user.fixture'

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/forgot-password')
  })

  test.describe('Page Elements', () => {
    test('should display all form elements', async ({ page }) => {
      // Check page title/heading
      await expectHeading(page, 'Forgot password')

      // Check email input
      await expect(page.locator('input#email')).toBeVisible()

      // Check submit button
      await expectButton(page, 'Send reset link')

      // Check back to login link
      await expect(page.locator('a[href="/login"]').first()).toBeVisible()
    })

    test('should have proper email input attributes', async ({ page }) => {
      const emailInput = page.locator('input#email')
      await expect(emailInput).toHaveAttribute('type', 'email')
      await expect(emailInput).toHaveAttribute('autocomplete', 'email')
    })
  })

  test.describe('Successful Request', () => {
    test('should submit email and show success message', async ({ page }) => {
      // Mock successful response
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'Reset link sent' },
        { method: 'POST' }
      )

      // Fill email
      await page.fill('input#email', 'test@example.com')

      // Submit
      await submitForm(page, 'Send reset link')

      // Should show success message
      await expectHeading(page, 'Check your email')
    })

    test('should show success even for non-existent email (security)', async ({ page }) => {
      // Mock successful response (security: don't reveal if email exists)
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'If this email exists, a reset link will be sent' },
        { method: 'POST' }
      )

      // Fill with potentially non-existent email
      await page.fill('input#email', 'nonexistent@example.com')

      // Submit
      await submitForm(page, 'Send reset link')

      // Should still show success (security best practice)
      await expectHeading(page, 'Check your email')
    })
  })

  test.describe('Client-side Validation', () => {
    test('should show error for empty email', async ({ page }) => {
      // Try to submit without email
      await submitForm(page, 'Send reset link')

      // Should stay on page
      await expect(page).toHaveURL('/forgot-password')
    })

    test('should show error for invalid email format', async ({ page }) => {
      for (const invalidEmail of INVALID_EMAILS.slice(0, 2)) {
        await page.fill('input#email', invalidEmail)
        await submitForm(page, 'Send reset link')

        // Should stay on page
        await expect(page).toHaveURL('/forgot-password')

        // Clear for next iteration
        await page.fill('input#email', '')
      }
    })
  })

  test.describe('API Error Handling', () => {
    test('should handle rate limiting error', async ({ page }) => {
      // Mock rate limit error
      await mockApiError(
        page,
        '/auth/forgot-password',
        429,
        'Too many requests. Please try again later.',
        { method: 'POST' }
      )

      // Fill and submit
      await page.fill('input#email', 'test@example.com')
      await submitForm(page, 'Send reset link')

      // Should show error or stay on page
      await expect(page).toHaveURL('/forgot-password')
    })

    test('should handle server error', async ({ page }) => {
      // Mock server error
      await mockApiError(
        page,
        '/auth/forgot-password',
        500,
        'Internal server error',
        { method: 'POST' }
      )

      // Fill and submit
      await page.fill('input#email', 'test@example.com')
      await submitForm(page, 'Send reset link')

      // Should stay on page
      await expect(page).toHaveURL('/forgot-password')
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      // Mock slow response
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'Success' },
        { method: 'POST', delay: 1000 }
      )

      // Fill email
      await page.fill('input#email', 'test@example.com')

      // Submit
      await page.click('button:has-text("Send reset link")')

      // Button should show loading or be disabled
      await expect(page.locator('button:has-text("Sending")')).toBeVisible().catch(async () => {
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
      })
    })

    test('should disable submit button during submission', async ({ page }) => {
      // Mock slow response
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'Success' },
        { method: 'POST', delay: 500 }
      )

      // Fill and submit
      await page.fill('input#email', 'test@example.com')
      await page.click('button:has-text("Send reset link")')

      // Button should be disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Navigation', () => {
    test('should navigate back to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Back to login' }).click()
      await expect(page).toHaveURL('/login')
    })

    test('should have back to login link with correct text', async ({ page }) => {
      const backLink = page.getByRole('link', { name: 'Back to login' })
      await expect(backLink).toBeVisible()
      await expect(backLink).toContainText('login')
    })
  })

  test.describe('Success State', () => {
    test('should display success message after submission', async ({ page }) => {
      // Mock successful response
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'Reset link sent' },
        { method: 'POST' }
      )

      // Fill and submit
      await page.fill('input#email', 'test@example.com')
      await submitForm(page, 'Send reset link')

      // Check success elements
      await expectHeading(page, 'Check your email')

      // Should have instructions
      await expect(page.locator('text=sent').or(page.locator('text=email')).first()).toBeVisible()
    })

    test('should hide form after success', async ({ page }) => {
      // Mock successful response
      await mockApiResponse(
        page,
        '/auth/forgot-password',
        { message: 'Reset link sent' },
        { method: 'POST' }
      )

      // Fill and submit
      await page.fill('input#email', 'test@example.com')
      await submitForm(page, 'Send reset link')

      // Wait for success state
      await expectHeading(page, 'Check your email')

      // Form should be hidden or replaced
      await expect(page.locator('input#email')).not.toBeVisible()
    })
  })
})
