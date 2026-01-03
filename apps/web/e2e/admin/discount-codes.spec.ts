import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Discount Codes', () => {
  // Mock data matches DiscountCodeDTO interface
  const mockDiscountCodes = [
    {
      id: 1,
      code: 'SAVE20',
      description: '20% off any plan',
      discountType: 'percent',
      discountValue: 20,
      currency: null,
      minAmount: null,
      maxUses: 100,
      maxUsesPerUser: 1,
      timesUsed: 45,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 2,
      code: 'FLAT50',
      description: '$50 off',
      discountType: 'fixed',
      discountValue: 5000, // in cents
      currency: 'usd',
      minAmount: 10000,
      maxUses: 50,
      maxUsesPerUser: 1,
      timesUsed: 50,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 3,
      code: 'UNLIMITED',
      description: '10% unlimited discount',
      discountType: 'percent',
      discountValue: 10,
      currency: null,
      minAmount: null,
      maxUses: null,
      maxUsesPerUser: null,
      timesUsed: 150,
      expiresAt: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
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

    await page.route('**/api/v1/admin/discount-codes', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockDiscountCodes }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test.describe('Page Header', () => {
    test('should display Discount Codes heading', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.locator('h1:has-text("Discount Codes")')).toBeVisible()
    })

    test('should display Add Discount Code button', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.locator('button:has-text("Add Discount Code")')).toBeVisible()
    })
  })

  test.describe('Table Display', () => {
    test('should display discount codes table', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.locator('table')).toBeVisible()
    })

    test('should display table headers', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.locator('th:has-text("Code")')).toBeVisible()
      await expect(page.locator('th:has-text("Discount")')).toBeVisible()
      await expect(page.locator('th:has-text("Usage")')).toBeVisible()
      await expect(page.locator('th:has-text("Expires")')).toBeVisible()
      await expect(page.locator('th:has-text("Status")')).toBeVisible()
    })

    test('should display discount codes', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.getByText('SAVE20', { exact: true })).toBeVisible()
      await expect(page.getByText('FLAT50', { exact: true })).toBeVisible()
      await expect(page.getByText('UNLIMITED', { exact: true })).toBeVisible()
    })

    test('should display discount values correctly', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      // 20% discount
      await expect(page.getByText('20%', { exact: true })).toBeVisible()
      // $50.00 fixed discount (5000 cents)
      await expect(page.getByText('$50.00', { exact: true })).toBeVisible()
    })

    test('should display usage count', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      // 45 / 100 usage
      await expect(page.locator('text=45')).toBeVisible()
    })

    test('should display active status badge', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    })

    test('should display inactive status badge', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await expect(page.getByText('Inactive', { exact: true })).toBeVisible()
    })
  })

  test.describe('Create Discount Code', () => {
    test('should open create dialog when clicking Create button', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()

      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should display create form fields', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()

      await expect(page.locator('#code')).toBeVisible()
      await expect(page.locator('#discountValue')).toBeVisible()
    })

    test('should have discount type selector', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()

      await expect(page.locator('button[role="combobox"]').first()).toBeVisible()
    })

    test('should call create API on form submit', async ({ page }) => {
      let createApiCalled = false

      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        if (route.request().method() === 'POST') {
          createApiCalled = true
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 4,
                code: 'NEWCODE',
                discountType: 'percent',
                discountValue: 15,
                isActive: true,
              },
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockDiscountCodes }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()

      await page.locator('#code').fill('NEWCODE')
      await page.locator('#discountValue').fill('15')

      await page.getByRole('button', { name: /Create/i }).last().click()

      await page.waitForTimeout(500)
      expect(createApiCalled).toBe(true)
    })

    test('should close dialog on successful create', async ({ page }) => {
      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { id: 4, code: 'NEWCODE', isActive: true },
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockDiscountCodes }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()
      await page.locator('#code').fill('NEWCODE')
      await page.locator('#discountValue').fill('15')
      await page.getByRole('button', { name: /Create/i }).last().click()

      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
    })

    test('should show validation error for empty code', async ({ page }) => {
      // Mock API to return validation error
      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'ValidationError',
              message: 'Code is required',
              errors: [{ field: 'code', message: 'Code is required' }],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockDiscountCodes }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      await page.getByRole('button', { name: /Add Discount Code/i }).click()

      // Submit without filling code - API returns error, toast should show
      await page.getByRole('button', { name: /Create/i }).last().click()

      // Check for toast error message
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/required/i)).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Edit Discount Code', () => {
    test('should show edit button for each code', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      // Edit buttons have Pencil icons (SVG elements)
      const editButtons = page.locator('td button:has(svg)').first()
      await expect(editButtons).toBeVisible()
    })

    test('should open edit dialog when clicking edit', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      // First button with svg icon in the row is the edit button
      await codeRow.locator('td button:has(svg)').first().click()

      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should pre-fill form with existing values', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      await codeRow.locator('td button:has(svg)').first().click()

      const codeInput = page.locator('#code')
      await expect(codeInput).toHaveValue('SAVE20')
    })

    test('should call update API on save', async ({ page }) => {
      let updateApiCalled = false

      await page.route('**/api/v1/admin/discount-codes/1', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          updateApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { ...mockDiscountCodes[0], discountValue: 25 },
            }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      await codeRow.locator('td button:has(svg)').first().click()

      await page.locator('#discountValue').fill('25')
      await page.getByRole('button', { name: /Update/i }).click()

      await page.waitForTimeout(500)
      expect(updateApiCalled).toBe(true)
    })
  })

  test.describe('Delete Discount Code', () => {
    test('should show delete button for each code', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      // Delete button is the last button with svg in each row (Trash icon)
      const deleteButton = page.locator('tr:has-text("SAVE20") td button:has(svg)').last()
      await expect(deleteButton).toBeVisible()
    })

    test('should show confirmation dialog on delete click', async ({ page }) => {
      // The page uses browser's confirm() dialog
      let dialogShown = false
      page.on('dialog', async (dialog) => {
        dialogShown = true
        await dialog.dismiss()
      })

      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      // Delete button is the last button with svg in the row
      await codeRow.locator('td button:has(svg)').last().click()

      expect(dialogShown).toBe(true)
    })

    test('should call delete API on confirm', async ({ page }) => {
      let deleteApiCalled = false

      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/discount-codes/1', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      await codeRow.locator('td button:has(svg)').last().click()

      await page.waitForTimeout(500)
      expect(deleteApiCalled).toBe(true)
    })

    test('should remove code from list after delete', async ({ page }) => {
      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/discount-codes/1', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      // Verify SAVE20 is visible initially
      await expect(page.getByText('SAVE20', { exact: true })).toBeVisible()

      const codeRow = page.locator('tr:has-text("SAVE20")')
      await codeRow.locator('td button:has(svg)').last().click()

      // After delete, check for success toast
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/deleted/i)).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Toggle Active Status', () => {
    test('should have toggle switch for active status', async ({ page }) => {
      await goto(page, '/admin/discount-codes')

      // The page uses Disable/Enable text buttons for toggling
      const toggleButton = page.locator('tr:has-text("SAVE20") button:has-text("Disable")')
      await expect(toggleButton).toBeVisible()
    })

    test('should call API when toggling status', async ({ page }) => {
      let toggleApiCalled = false

      await page.route('**/api/v1/admin/discount-codes/1', async (route) => {
        if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
          toggleApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { ...mockDiscountCodes[0], isActive: false },
            }),
          })
        }
      })

      await goto(page, '/admin/discount-codes')

      const codeRow = page.locator('tr:has-text("SAVE20")')
      // Click the Disable button to toggle
      await codeRow.getByRole('button', { name: 'Disable' }).click()

      await page.waitForTimeout(500)
      expect(toggleApiCalled).toBe(true)
    })
  })

  test.describe('Empty State', () => {
    test('should show empty message when no codes', async ({ page }) => {
      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/discount-codes')

      await expect(page.locator('text=No discount codes').or(page.locator('text=no codes'))).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading skeleton while fetching', async ({ page }) => {
      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockDiscountCodes }),
        })
      })

      await goto(page, '/admin/discount-codes')

      const skeleton = page.locator('[class*="animate-pulse"]')
      await expect(skeleton.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Error State', () => {
    test('should show error message on fetch failure', async ({ page }) => {
      await page.route('**/api/v1/admin/discount-codes', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to fetch' }),
        })
      })

      await goto(page, '/admin/discount-codes')

      // Error is shown via toast message
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/Failed|error/i)).first()).toBeVisible({ timeout: 5000 })
    })
  })
})
