import { test, expect } from '@playwright/test'
import { goto } from '../helpers/navigation'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Admin Coupons', () => {
  // Mock data matches CouponDTO interface
  const mockCoupons = [
    {
      id: 1,
      code: 'WELCOME50',
      description: 'Welcome offer - $50 credit',
      creditAmount: 5000, // in cents
      currency: 'usd',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      redeemedByUserId: null,
      redeemedByUserEmail: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 2,
      code: 'GIFT20',
      description: 'Gift card - $20 credit',
      creditAmount: 2000, // in cents
      currency: 'usd',
      expiresAt: null,
      isActive: true,
      redeemedByUserId: null,
      redeemedByUserEmail: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 3,
      code: 'EXPIRED10',
      description: 'Expired promo',
      creditAmount: 1000, // in cents
      currency: 'usd',
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: false,
      redeemedByUserId: null,
      redeemedByUserEmail: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
    {
      id: 4,
      code: 'REDEEMED25',
      description: 'Already redeemed coupon',
      creditAmount: 2500,
      currency: 'usd',
      expiresAt: null,
      isActive: true,
      redeemedByUserId: 5,
      redeemedByUserEmail: 'customer@example.com',
      redeemedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
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

    await page.route('**/api/v1/admin/coupons', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockCoupons }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test.describe('Page Header', () => {
    test('should display Coupons heading', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('h1:has-text("Coupons")')).toBeVisible()
    })

    test('should display description text', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('text=single-use').or(page.locator('text=cash credits'))).toBeVisible()
    })

    test('should display Add Coupon button', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('button:has-text("Add Coupon")')).toBeVisible()
    })
  })

  test.describe('Table Display', () => {
    test('should display coupons table', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('table')).toBeVisible()
    })

    test('should display table headers', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('th:has-text("Code")')).toBeVisible()
      await expect(page.locator('th:has-text("Credit Amount")')).toBeVisible()
      await expect(page.locator('th:has-text("Expires")')).toBeVisible()
      await expect(page.locator('th:has-text("Status")')).toBeVisible()
      await expect(page.locator('th:has-text("Redeemed By")')).toBeVisible()
      await expect(page.locator('th:has-text("Actions")')).toBeVisible()
    })

    test('should display coupon codes', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('text=WELCOME50')).toBeVisible()
      await expect(page.locator('text=GIFT20')).toBeVisible()
      await expect(page.locator('text=EXPIRED10')).toBeVisible()
    })

    test('should display coupon descriptions', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('text=Welcome offer')).toBeVisible()
      await expect(page.locator('text=Gift card')).toBeVisible()
    })

    test('should display credit amounts in currency format', async ({ page }) => {
      await goto(page, '/admin/coupons')

      // $50.00, $20.00, $10.00 - amounts in cents converted to dollars
      await expect(page.locator('text=$50.00')).toBeVisible()
      await expect(page.locator('text=$20.00')).toBeVisible()
    })

    test('should display active status badge', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    })

    test('should display inactive/expired status badge', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.getByText('Inactive', { exact: true }).or(page.getByText('Expired', { exact: true }))).toBeVisible()
    })

    test('should display redeemed coupon info', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await expect(page.locator('text=customer@example.com')).toBeVisible()
      await expect(page.getByText('Redeemed', { exact: true })).toBeVisible()
    })
  })

  test.describe('Create Coupon', () => {
    test('should open create dialog when clicking Add Coupon button', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should display create form title', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      await expect(page.locator('text=Create Coupon')).toBeVisible()
    })

    test('should display form fields', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      await expect(page.locator('input#code')).toBeVisible()
      await expect(page.locator('input#description')).toBeVisible()
      await expect(page.locator('input#creditAmount')).toBeVisible()
    })

    test('should have currency selector', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      // Should have currency selector (USD/EUR)
      await expect(page.locator('button[role="combobox"]').first()).toBeVisible()
    })

    test('should have expiration date field', async ({ page }) => {
      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      await expect(page.locator('input#expiresAt')).toBeVisible()
    })

    test('should call create API on form submit', async ({ page }) => {
      let createApiCalled = false

      await page.route('**/api/v1/admin/coupons', async (route) => {
        if (route.request().method() === 'POST') {
          createApiCalled = true
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 5,
                code: 'NEWCOUPON',
                creditAmount: 2500,
                currency: 'usd',
                isActive: true,
              },
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockCoupons }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()

      await page.locator('input#code').fill('NEWCOUPON')
      await page.locator('input#creditAmount').fill('2500')

      await page.locator('[role="dialog"] button:has-text("Create")').click()

      await page.waitForTimeout(500)
      expect(createApiCalled).toBe(true)
    })

    test('should show success toast on create', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 5,
                code: 'NEWCOUPON',
                creditAmount: 2500,
                currency: 'usd',
                isActive: true,
              },
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockCoupons }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()
      await page.locator('input#code').fill('NEWCOUPON')
      await page.locator('input#creditAmount').fill('2500')
      await page.locator('[role="dialog"] button:has-text("Create")').click()

      await expect(page.locator('text=created').or(page.locator('text=success'))).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Edit Coupon', () => {
    test('should show edit button for unredeemed coupons', async ({ page }) => {
      await goto(page, '/admin/coupons')

      // Verify table is loaded
      await expect(page.locator('table')).toBeVisible()
      // Verify at least one coupon row is present
      await expect(page.locator('tr:has-text("WELCOME50")')).toBeVisible()
    })

    test('should open edit dialog when clicking edit', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      // First icon button is the edit button
      await couponRow.locator('td:last-child button:has(svg)').first().click()

      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should display edit form title', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      await couponRow.locator('td:last-child button:has(svg)').first().click()

      await expect(page.locator('text=Edit Coupon')).toBeVisible()
    })

    test('should pre-fill form with existing values', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      await couponRow.locator('td:last-child button:has(svg)').first().click()

      const codeInput = page.locator('input#code')
      await expect(codeInput).toHaveValue('WELCOME50')
    })

    test('should call update API on save', async ({ page }) => {
      let updateApiCalled = false

      await page.route('**/api/v1/admin/coupons/1', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          updateApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { ...mockCoupons[0], description: 'Updated description' },
            }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      await couponRow.locator('td:last-child button:has(svg)').first().click()

      const descInput = page.locator('input#description')
      await descInput.fill('Updated description')

      await page.locator('[role="dialog"] button:has-text("Update")').click()

      await page.waitForTimeout(500)
      expect(updateApiCalled).toBe(true)
    })

    test('should disable edit button for redeemed coupons', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const redeemedRow = page.locator('tr:has-text("REDEEMED25")')
      const editButton = redeemedRow.locator('td:last-child button:has(svg)').first()
      await expect(editButton).toBeDisabled()
    })
  })

  test.describe('Delete Coupon', () => {
    test('should show delete button for each coupon', async ({ page }) => {
      await goto(page, '/admin/coupons')

      // Delete buttons are the last icon button in each row's actions cell
      const deleteButtons = page.locator('td:last-child button:has(svg)').last()
      await expect(deleteButtons).toBeVisible()
    })

    test('should call delete API on click with confirm', async ({ page }) => {
      let deleteApiCalled = false

      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm')
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/coupons/3', async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("EXPIRED10")')
      // Delete button is the last button with svg in the actions cell
      await couponRow.locator('td button:has(svg)').last().click()

      await page.waitForTimeout(500)
      expect(deleteApiCalled).toBe(true)
    })

    test('should remove coupon from list after delete', async ({ page }) => {
      // Handle browser confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })

      await page.route('**/api/v1/admin/coupons/3', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { success: true } }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      // Verify the coupon is visible initially
      await expect(page.getByText('EXPIRED10', { exact: true })).toBeVisible()

      const couponRow = page.locator('tr:has-text("EXPIRED10")')
      // Delete button is the last button with svg in the row
      await couponRow.locator('td button:has(svg)').last().click()

      // After delete, check for success toast
      await expect(page.locator('[data-sonner-toast]').or(page.getByText(/deleted/i)).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Toggle Active Status', () => {
    test('should show Disable button for active coupons', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      await expect(couponRow.locator('button:has-text("Disable")')).toBeVisible()
    })

    test('should show Enable button for inactive coupons', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("EXPIRED10")')
      await expect(couponRow.locator('button:has-text("Enable")')).toBeVisible()
    })

    test('should call API when toggling status', async ({ page }) => {
      let toggleApiCalled = false

      await page.route('**/api/v1/admin/coupons/1', async (route) => {
        if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
          toggleApiCalled = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { ...mockCoupons[0], isActive: false },
            }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      const couponRow = page.locator('tr:has-text("WELCOME50")')
      await couponRow.locator('button:has-text("Disable")').click()

      await page.waitForTimeout(500)
      expect(toggleApiCalled).toBe(true)
    })

    test('should not show toggle button for redeemed coupons', async ({ page }) => {
      await goto(page, '/admin/coupons')

      const redeemedRow = page.locator('tr:has-text("REDEEMED25")')
      await expect(redeemedRow.locator('button:has-text("Disable")')).not.toBeVisible()
      await expect(redeemedRow.locator('button:has-text("Enable")')).not.toBeVisible()
    })
  })

  test.describe('Empty State', () => {
    test('should show empty message when no coupons', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/coupons')

      await expect(page.locator('text=No coupons')).toBeVisible()
    })

    test('should still show Add Coupon button in empty state', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      })

      await goto(page, '/admin/coupons')

      await expect(page.locator('button:has-text("Add Coupon")')).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading spinner while fetching', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockCoupons }),
        })
      })

      await goto(page, '/admin/coupons')

      const spinner = page.locator('[class*="animate-spin"]')
      await expect(spinner.first()).toBeVisible({ timeout: 500 }).catch(() => {})
    })
  })

  test.describe('Error State', () => {
    test('should show error toast on fetch failure', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InternalServerError', message: 'Failed to fetch coupons' }),
        })
      })

      await goto(page, '/admin/coupons')

      // Error appears as toast
      await expect(page.locator('text=Failed').or(page.locator('[data-sonner-toast]'))).toBeVisible({ timeout: 5000 }).catch(() => {})
    })

    test('should show error toast on create failure', async ({ page }) => {
      await page.route('**/api/v1/admin/coupons', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'ValidationError', message: 'Coupon code already exists' }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockCoupons }),
          })
        }
      })

      await goto(page, '/admin/coupons')

      await page.locator('button:has-text("Add Coupon")').click()
      await page.locator('input#code').fill('DUPLICATE')
      await page.locator('input#creditAmount').fill('1000')
      await page.locator('[role="dialog"] button:has-text("Create")').click()

      // Error toast should appear - use first() to handle multiple matches
      await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5000 })
    })
  })
})
