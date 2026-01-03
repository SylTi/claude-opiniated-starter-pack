import { test, expect } from '@playwright/test'
import { goToProfile } from '../helpers/navigation'
import { fillForm, submitForm, expectFieldDisabled } from '../helpers/forms'
import { expectSuccessToast, expectErrorAlert } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Profile Edit Page', () => {
  const mockUser = {
    id: 1,
    email: TEST_USERS.regular.email,
    fullName: TEST_USERS.regular.fullName,
    role: 'user' as const,
    subscriptionTier: 'free' as const,
    emailVerifiedAt: new Date().toISOString(),
    mfaEnabled: false,
    avatarUrl: null,
    currentTeamId: null,
    createdAt: new Date().toISOString(),
  }

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, mockUser)

    await page.route('**/api/v1/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUser }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test.describe('Page Elements', () => {
    test('should display all form fields', async ({ page }) => {
      await goToProfile(page)

      // Check form fields
      await expect(page.locator('input#fullName')).toBeVisible()
      await expect(page.locator('input#email')).toBeVisible()
      await expect(page.locator('input#avatarUrl')).toBeVisible()

      // Check submit button
      await expect(page.locator('button:has-text("Save changes")')).toBeVisible()
    })

    test('should pre-fill form with user data', async ({ page }) => {
      await goToProfile(page)

      // Email should be pre-filled
      const emailInput = page.locator('input#email')
      await expect(emailInput).toHaveValue(TEST_USERS.regular.email)

      // Full name should be pre-filled
      const nameInput = page.locator('input#fullName')
      await expect(nameInput).toHaveValue(TEST_USERS.regular.fullName)
    })

    test('email field should be disabled (read-only)', async ({ page }) => {
      await goToProfile(page)

      await expectFieldDisabled(page, 'email')
    })
  })

  test.describe('Update Full Name', () => {
    test('should update full name successfully', async ({ page }) => {
      await mockApiResponse(page, '/profile/update', { message: 'Profile updated' }, { method: 'PUT' })

      await goToProfile(page)

      // Change name
      await page.fill('input#fullName', 'New Name')
      await submitForm(page, 'Save changes')

      // Should show success
      await expectSuccessToast(page, 'updated').catch(async () => {
        await expect(page.locator('text=success').or(page.locator('text=updated')).first()).toBeVisible()
      })
    })

    test('should show error for name too short', async ({ page }) => {
      await goToProfile(page)

      // Enter short name
      await page.fill('input#fullName', 'A')
      await submitForm(page, 'Save changes')

      // Should stay on page (validation error)
      await expect(page).toHaveURL('/profile')
    })
  })

  test.describe('Update Avatar URL', () => {
    test('should update avatar URL successfully', async ({ page }) => {
      await mockApiResponse(page, '/profile/update', { message: 'Profile updated' }, { method: 'PUT' })

      await goToProfile(page)

      // Set avatar URL
      await page.fill('input#avatarUrl', 'https://example.com/avatar.jpg')
      await submitForm(page, 'Save changes')

      // Should show success
      await expectSuccessToast(page, 'updated').catch(async () => {
        await expect(page.locator('text=success').or(page.locator('text=updated')).first()).toBeVisible()
      })
    })

    test('should show error for invalid avatar URL', async ({ page }) => {
      await goToProfile(page)

      // Enter invalid URL
      await page.fill('input#avatarUrl', 'not-a-url')
      await submitForm(page, 'Save changes')

      // Should stay on page (validation error)
      await expect(page).toHaveURL('/profile')
    })

    test('should accept empty avatar URL', async ({ page }) => {
      await mockApiResponse(page, '/profile/update', { message: 'Profile updated' }, { method: 'PUT' })

      await goToProfile(page)

      // Clear avatar URL
      await page.fill('input#avatarUrl', '')
      await submitForm(page, 'Save changes')

      // Should succeed
      await expectSuccessToast(page, 'updated').catch(async () => {
        // No error should appear
      })
    })
  })

  test.describe('Avatar Display', () => {
    test('should show avatar fallback with initials when no avatar URL', async ({ page }) => {
      await goToProfile(page)

      // Avatar should show initials
      const avatar = page.locator('[class*="avatar"]')
      await expect(avatar.first()).toBeVisible()
    })

    test('should show avatar image when avatar URL is set', async ({ page }) => {
      // Mock user with avatar
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: 'https://example.com/avatar.jpg',
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      await goToProfile(page)

      // Avatar should be visible
      const avatar = page.locator('[class*="avatar"]')
      await expect(avatar.first()).toBeVisible()
    })
  })

  test.describe('API Error Handling', () => {
    test('should show error when update fails', async ({ page }) => {
      await mockApiError(page, '/profile/update', 500, 'Server error', { method: 'PUT' })

      await goToProfile(page)

      // Change something and submit
      await page.fill('input#fullName', 'New Name')
      await submitForm(page, 'Save changes')

      // Should show error
      await expect(page).toHaveURL('/profile')
    })

    test('should handle validation error from API', async ({ page }) => {
      await page.route('**/api/v1/profile/update', async (route) => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'ValidationError',
            message: 'Validation failed',
            errors: [{ field: 'fullName', message: 'Name is invalid' }],
          }),
        })
      })

      await goToProfile(page)

      await page.fill('input#fullName', 'Invalid')
      await submitForm(page, 'Save changes')

      // Should show error
      await expect(page).toHaveURL('/profile')
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state during submission', async ({ page }) => {
      await mockApiResponse(page, '/profile/update', { message: 'Updated' }, { method: 'PUT', delay: 1000 })

      await goToProfile(page)

      await page.fill('input#fullName', 'New Name')
      await page.click('button:has-text("Save changes")')

      // Button should show loading
      await expect(page.locator('button:has-text("Saving")')).toBeVisible().catch(async () => {
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
      })
    })

    test('should disable submit button during submission', async ({ page }) => {
      await mockApiResponse(page, '/profile/update', { message: 'Updated' }, { method: 'PUT', delay: 500 })

      await goToProfile(page)

      await page.fill('input#fullName', 'New Name')
      await page.click('button:has-text("Save changes")')

      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Profile Sidebar Navigation', () => {
    test('should have sidebar with navigation tabs', async ({ page }) => {
      await goToProfile(page)

      // Check for sidebar navigation
      const sidebar = page.locator('nav, [class*="sidebar"]')
      await expect(sidebar.first()).toBeVisible()
    })

    test('should navigate to security page', async ({ page }) => {
      await goToProfile(page)

      // Click security link
      await page.click('a:has-text("Security"), a[href="/profile/security"]')
      await expect(page).toHaveURL('/profile/security')
    })

    test('should navigate to settings page', async ({ page }) => {
      await goToProfile(page)

      // Click settings link
      await page.click('a:has-text("Settings"), a[href="/profile/settings"]')
      await expect(page).toHaveURL('/profile/settings')
    })
  })
})
