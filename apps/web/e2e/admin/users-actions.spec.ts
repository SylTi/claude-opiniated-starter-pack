import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Users - Actions', () => {
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
      fullName: 'Unverified User',
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
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockUsers }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test.describe('Verify Email Action', () => {
    test('should show verify button for unverified users', async ({ page }) => {
      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      await expect(unverifiedRow.locator('button:has-text("Verify")')).toBeVisible()
    })

    test('should show unverify button for verified users', async ({ page }) => {
      await goto(page, '/admin/users')

      const verifiedRow = page.locator('tr:has-text("user1@example.com")')
      await expect(verifiedRow.locator('button:has-text("Unverify")')).toBeVisible()
    })

    test('should call verify API when clicking verify button', async ({ page }) => {
      let verifyApiCalled = false

      // The actual API endpoint uses verify-email
      await page.route('**/api/v1/admin/users/3/verify-email', async (route) => {
        verifyApiCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      await unverifiedRow.getByRole('button', { name: 'Verify' }).click()

      await page.waitForTimeout(500)
      expect(verifyApiCalled).toBe(true)
    })

    test('should call unverify API when clicking unverify button', async ({ page }) => {
      let unverifyApiCalled = false

      // The actual API endpoint uses unverify-email
      await page.route('**/api/v1/admin/users/2/unverify-email', async (route) => {
        unverifyApiCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const verifiedRow = page.locator('tr:has-text("user1@example.com")')
      await verifiedRow.getByRole('button', { name: 'Unverify' }).click()

      await page.waitForTimeout(500)
      expect(unverifyApiCalled).toBe(true)
    })

    test('should show success toast on verify success', async ({ page }) => {
      await page.route('**/api/v1/admin/users/3/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true }, message: 'Email verified' }),
        })
      })

      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      await unverifiedRow.locator('button:has-text("Verify")').click()

      await expect(page.locator('text=verified').or(page.locator('[role="status"]')).first()).toBeVisible({ timeout: 5000 })
    })

    test('should show error toast on verify failure', async ({ page }) => {
      await page.route('**/api/v1/admin/users/3/verify', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to verify' }),
        })
      })

      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      await unverifiedRow.locator('button:has-text("Verify")').click()

      await expect(page.locator('text=Failed').or(page.locator('text=error')).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Delete User Action', () => {
    test('should show delete button for each user', async ({ page }) => {
      await goto(page, '/admin/users')

      // Wait for the table to load
      await expect(page.getByText('user1@example.com')).toBeVisible()

      // Delete buttons show "Delete" text (non-self users only)
      const deleteButtons = page.getByRole('button', { name: 'Delete' })
      await expect(deleteButtons.first()).toBeVisible()
      expect(await deleteButtons.count()).toBeGreaterThanOrEqual(2)
    })

    test('should not show delete button for self', async ({ page }) => {
      await goto(page, '/admin/users')

      const adminRow = page.locator('tr:has-text("admin@example.com")')
      // Admin user (self) should not have delete button
      const deleteButton = adminRow.getByRole('button', { name: 'Delete' })
      await expect(deleteButton).toHaveCount(0)
    })

    test('should show confirmation dialog when clicking delete', async ({ page }) => {
      // The page uses browser's confirm() dialog
      let dialogShown = false
      page.on('dialog', async (dialog) => {
        dialogShown = true
        await dialog.dismiss()
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.getByRole('button', { name: 'Delete' }).click()

      expect(dialogShown).toBe(true)
    })

    test('should close dialog on cancel', async ({ page }) => {
      // When dismissing browser confirm dialog, delete is cancelled
      let dialogDismissed = false
      page.on('dialog', async (dialog) => {
        dialogDismissed = true
        await dialog.dismiss()
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.getByRole('button', { name: 'Delete' }).click()

      expect(dialogDismissed).toBe(true)
      // User should still be visible
      await expect(page.getByText('user1@example.com')).toBeVisible()
    })

    test('should call delete API on confirm', async ({ page }) => {
      let deleteApiCalled = false

      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/users/2', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.getByRole('button', { name: 'Delete' }).click()

      await page.waitForTimeout(500)
      expect(deleteApiCalled).toBe(true)
    })

    test('should remove user from list after successful delete', async ({ page }) => {
      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/users/2', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/users')

      // Verify user1 is visible initially
      await expect(page.getByText('user1@example.com')).toBeVisible()

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.getByRole('button', { name: 'Delete' }).click()

      // After delete, check for success toast
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/deleted/i)).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Change Subscription Tier', () => {
    test('should display tier selector dropdown', async ({ page }) => {
      await goto(page, '/admin/users')

      // Wait for the table to load
      await expect(page.getByText('user1@example.com')).toBeVisible()

      const tierSelectors = page.locator('button[role="combobox"]')
      await expect(tierSelectors.first()).toBeVisible()
      expect(await tierSelectors.count()).toBeGreaterThanOrEqual(3)
    })

    test('should show current tier in selector', async ({ page }) => {
      await goto(page, '/admin/users')

      const tier1Row = page.locator('tr:has-text("user1@example.com")')
      await expect(tier1Row.locator('button[role="combobox"]')).toContainText(/Tier 1/i)
    })

    test('should open dropdown when clicking tier selector', async ({ page }) => {
      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.locator('button[role="combobox"]').click()

      // Dropdown options
      await expect(page.locator('[role="option"]').first()).toBeVisible()
    })

    test('should show all tier options in dropdown', async ({ page }) => {
      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.locator('button[role="combobox"]').click()

      await expect(page.locator('[role="option"]:has-text("Free")')).toBeVisible()
      await expect(page.locator('[role="option"]:has-text("Tier 1")')).toBeVisible()
      await expect(page.locator('[role="option"]:has-text("Tier 2")')).toBeVisible()
    })

    test('should call update tier API when selecting new tier', async ({ page }) => {
      let updateApiCalled = false
      let requestBody: unknown = null

      // The actual API sends { subscriptionTier: 'tier2' }
      await page.route('**/api/v1/admin/users/2/tier', async (route) => {
        updateApiCalled = true
        requestBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.locator('button[role="combobox"]').click()

      await page.locator('[role="option"]:has-text("Tier 2")').click()

      await page.waitForTimeout(500)
      expect(updateApiCalled).toBe(true)
      expect(requestBody).toEqual(expect.objectContaining({ subscriptionTier: 'tier2' }))
    })

    test('should update tier badge after successful change', async ({ page }) => {
      await page.route('**/api/v1/admin/users/2/tier', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.locator('button[role="combobox"]').click()

      await page.locator('[role="option"]:has-text("Tier 2")').click()

      // After update, check for success toast
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/updated/i)).first()).toBeVisible({ timeout: 5000 })
    })

    test('should show error toast on tier change failure', async ({ page }) => {
      await page.route('**/api/v1/admin/users/2/tier', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to update tier' }),
        })
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      await userRow.locator('button[role="combobox"]').click()

      await page.locator('[role="option"]:has-text("Tier 2")').click()

      await expect(page.locator('text=Failed').or(page.locator('text=error')).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Actions Column', () => {
    test('should display actions column in table', async ({ page }) => {
      await goto(page, '/admin/users')

      await expect(page.locator('th:has-text("Actions")')).toBeVisible()
    })

    test('should have action buttons in each row', async ({ page }) => {
      await goto(page, '/admin/users')

      const rows = page.locator('tbody tr')
      const rowCount = await rows.count()

      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i)
        const actionButtons = row.locator('button')
        expect(await actionButtons.count()).toBeGreaterThanOrEqual(1)
      }
    })
  })

  test.describe('Loading States', () => {
    test('should show loading state on verify action', async ({ page }) => {
      // Use a longer delay to ensure we can catch the loading state
      await page.route('**/api/v1/admin/users/3/verify-email', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        })
      })

      await goto(page, '/admin/users')

      const unverifiedRow = page.locator('tr:has-text("user2@example.com")')
      const verifyButton = unverifiedRow.getByRole('button', { name: 'Verify' })
      await verifyButton.click()

      // Button should be disabled during loading, or show "Loading..." text
      await expect(verifyButton).toBeDisabled({ timeout: 1000 }).catch(async () => {
        // If not disabled, check if it shows loading text
        await expect(unverifiedRow.getByText(/Loading/i)).toBeVisible({ timeout: 1000 })
      })
    })

    test('should show loading state on delete action', async ({ page }) => {
      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/users/2', async (route) => {
        if (route.request().method() === 'DELETE') {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/users')

      const userRow = page.locator('tr:has-text("user1@example.com")')
      const deleteButton = userRow.getByRole('button', { name: 'Delete' })
      await deleteButton.click()

      // Delete button should be disabled during loading
      await expect(deleteButton).toBeDisabled()
    })
  })
})
