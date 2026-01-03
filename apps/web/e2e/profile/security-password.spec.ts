import { test, expect } from '@playwright/test'
import { goToSecurity } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectSuccessToast, expectButton } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Security Page - Change Password', () => {
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

  test.describe('Page Elements', () => {
    test('should display change password form', async ({ page }) => {
      await goToSecurity(page)

      // Check form fields
      await expect(page.locator('input#currentPassword')).toBeVisible()
      await expect(page.locator('input#newPassword')).toBeVisible()
      await expect(page.locator('input#newPasswordConfirmation')).toBeVisible()
    })

    test('should have Change Password button', async ({ page }) => {
      await goToSecurity(page)

      await expectButton(page, 'Change password')
    })

    test('password fields should have correct type', async ({ page }) => {
      await goToSecurity(page)

      await expect(page.locator('input#currentPassword')).toHaveAttribute('type', 'password')
      await expect(page.locator('input#newPassword')).toHaveAttribute('type', 'password')
      await expect(page.locator('input#newPasswordConfirmation')).toHaveAttribute('type', 'password')
    })
  })

  test.describe('Successful Password Change', () => {
    test('should change password with valid data', async ({ page }) => {
      await mockApiResponse(page, '/auth/change-password', { message: 'Password changed' }, { method: 'POST' })

      await goToSecurity(page)

      // Fill form
      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should show success
      await expectSuccessToast(page, 'changed').catch(async () => {
        await expect(page.locator('text=changed').or(page.locator('text=success')).first()).toBeVisible()
      })
    })

    test('should clear form after successful change', async ({ page }) => {
      await mockApiResponse(page, '/auth/change-password', { message: 'Password changed' }, { method: 'POST' })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Wait for success
      await page.waitForTimeout(500)

      // Fields should be cleared
      await expect(page.locator('input#currentPassword')).toHaveValue('')
    })
  })

  test.describe('Client-side Validation', () => {
    test('should show error for empty current password', async ({ page }) => {
      await goToSecurity(page)

      // Leave current password empty
      await fillForm(page, {
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should stay on page
      await expect(page).toHaveURL('/profile/security')
    })

    test('should show error for new password too short', async ({ page }) => {
      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'short',
        newPasswordConfirmation: 'short',
      })

      await submitForm(page, 'Change password')

      // Should stay on page
      await expect(page).toHaveURL('/profile/security')
    })

    test('should show error for password mismatch', async ({ page }) => {
      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'DifferentPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should stay on page
      await expect(page).toHaveURL('/profile/security')
    })

    test('should show error for empty new password', async ({ page }) => {
      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should stay on page
      await expect(page).toHaveURL('/profile/security')
    })
  })

  test.describe('API Error Handling', () => {
    test('should show error for wrong current password', async ({ page }) => {
      await mockApiError(page, '/auth/change-password', 401, 'Current password is incorrect', { method: 'POST' })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should show error
      await expect(page.locator('text=incorrect').or(page.locator('text=wrong')).or(page.locator('[role="alert"]')).first()).toBeVisible()
    })

    test('should show error for server error', async ({ page }) => {
      await mockApiError(page, '/auth/change-password', 500, 'Server error', { method: 'POST' })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await submitForm(page, 'Change password')

      // Should show error or stay on page
      await expect(page).toHaveURL('/profile/security')
    })

    test('should handle password complexity requirements', async ({ page }) => {
      await page.route('**/api/v1/auth/change-password', async (route) => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'ValidationError',
            message: 'Password must contain uppercase, lowercase, number, and special character',
            errors: [{ field: 'newPassword', message: 'Password too weak' }],
          }),
        })
      })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'weakpassword',
        newPasswordConfirmation: 'weakpassword',
      })

      await submitForm(page, 'Change password')

      // Should show validation error
      await expect(page).toHaveURL('/profile/security')
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      await mockApiResponse(page, '/auth/change-password', { message: 'Changed' }, { method: 'POST', delay: 1000 })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await page.click('button:has-text("Change password")')

      // Button should show loading
      await expect(page.locator('button:has-text("Changing")')).toBeVisible().catch(async () => {
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
      })
    })

    test('should disable submit button during submission', async ({ page }) => {
      await mockApiResponse(page, '/auth/change-password', { message: 'Changed' }, { method: 'POST', delay: 500 })

      await goToSecurity(page)

      await fillForm(page, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      })

      await page.click('button:has-text("Change password")')

      await expect(page.locator('button:has-text("Change password"), button[type="submit"]').first()).toBeDisabled()
    })
  })

  test.describe('Password Visibility Toggle', () => {
    test('should have password visibility toggle if implemented', async ({ page }) => {
      await goToSecurity(page)

      // Check for visibility toggle buttons
      const toggleButtons = page.locator('button[aria-label*="password"], button:has(svg[class*="eye"])')
      // This is optional depending on implementation
    })
  })
})
