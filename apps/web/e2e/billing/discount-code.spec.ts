import { test, expect } from '@playwright/test'
import { goToBilling } from '../helpers/navigation'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Discount Codes', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'free' as const,
    emailVerifiedAt: new Date().toISOString(),
    mfaEnabled: false,
    avatarUrl: null,
    currentTeamId: null,
    createdAt: new Date().toISOString(),
  }

  const mockTiers = [
    {
      tier: { id: 1, name: 'Free', slug: 'free', level: 0, description: 'Basic features', features: {}, maxTeamMembers: null },
      prices: [],
    },
    {
      tier: { id: 2, name: 'Tier 1', slug: 'tier1', level: 1, description: 'Pro features', features: { advanced_analytics: true }, maxTeamMembers: 5 },
      prices: [
        { id: 1, unitAmount: 1999, currency: 'usd', interval: 'month', isActive: true, taxBehavior: 'exclusive' },
        { id: 2, unitAmount: 19990, currency: 'usd', interval: 'year', isActive: true, taxBehavior: 'exclusive' },
      ],
    },
  ]

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, mockUser)

    await page.route('**/api/v1/billing/tiers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockTiers }),
      })
    })

    await page.route('**/api/v1/billing/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { subscription: null, canManage: false, hasPaymentMethod: false } }),
      })
    })

    await page.route('**/api/v1/billing/balance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { balance: 0, currency: 'usd' } }),
      })
    })
  })

  test.describe('Discount Code Input', () => {
    test('should display discount code card', async ({ page }) => {
      await goToBilling(page)

      await expect(page.getByText('Discount Code', { exact: true })).toBeVisible()
    })

    test('should show discount code input field', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('input[placeholder*="discount"]')).toBeVisible()
    })

    test('should convert input to uppercase', async ({ page }) => {
      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('save20')

      await expect(discountInput).toHaveValue('SAVE20')
    })

    test('should show tag icon', async ({ page }) => {
      await goToBilling(page)

      const discountCard = page.locator('text=Discount Code').locator('..')
      const tagIcon = discountCard.locator('svg')
      await expect(tagIcon.first()).toBeVisible()
    })
  })

  test.describe('Clear Button', () => {
    test('should show clear button when code is entered', async ({ page }) => {
      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      // X button should appear
      const clearButton = page.locator('button:has(svg[class*="x"]), input[placeholder*="discount"] ~ button')
      await expect(clearButton.first()).toBeVisible()
    })

    test('should clear input when clicking X button', async ({ page }) => {
      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      // Click clear button
      const clearButton = page.locator('input[placeholder*="discount"]').locator('..').locator('button')
      await clearButton.click()

      await expect(discountInput).toHaveValue('')
    })

    test('should not show clear button when input is empty', async ({ page }) => {
      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await expect(discountInput).toHaveValue('')

      // Clear button should not be visible
      const clearButton = discountInput.locator('..').locator('button')
      await expect(clearButton).not.toBeVisible()
    })
  })

  test.describe('Discount Validation', () => {
    test('should validate discount code when clicking on a plan', async ({ page }) => {
      let validationCalled = false

      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        validationCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      // Click on upgrade button
      await page.click('button:has-text("Upgrade to Tier 1")')

      expect(validationCalled).toBe(true)
    })

    test('should show discount applied message for valid code', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(page.locator('text=Discount Applied')).toBeVisible()
    })

    test('should show original price with strikethrough', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Original price with strikethrough
      await expect(page.locator('[class*="line-through"]')).toBeVisible()
    })

    test('should show discounted price in green', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Discounted price in green
      const discountedPrice = page.locator('[class*="green"]').filter({ hasText: '$' })
      await expect(discountedPrice.first()).toBeVisible()
    })

    test('should show percentage badge for percent discounts', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(page.locator('text=20% OFF')).toBeVisible()
    })
  })

  test.describe('Invalid Discount Code', () => {
    test('should show error toast for invalid code', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: false,
              message: 'Invalid discount code',
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('INVALID')

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Should show error toast
      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=Invalid')).first()).toBeVisible()
    })

    test('should show error for expired discount code', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: false,
              message: 'Discount code has expired',
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('EXPIRED')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=expired')).first()).toBeVisible()
    })

    test('should show error for code that does not apply to selected plan', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'BadRequest',
            message: 'Discount code does not apply to this plan',
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('TIER2ONLY')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=does not apply')).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading state while validating', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Button should show loading
      await expect(page.locator('button:has-text("Loading")')).toBeVisible()
    })

    test('should disable input while validating', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(discountInput).toBeDisabled()
    })
  })

  test.describe('Clear Discount After Validation', () => {
    test('should clear discount when clicking X button', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 400,
              discountedAmount: 1599,
              discountCode: { code: 'SAVE20', discountType: 'percent', discountValue: 20 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      await page.click('button:has-text("Upgrade to Tier 1")')

      // Discount should be applied
      await expect(page.locator('text=Discount Applied')).toBeVisible()

      // Clear the discount
      const clearButton = discountInput.locator('..').locator('button')
      await clearButton.click()

      // Discount applied message should disappear
      await expect(page.locator('text=Discount Applied')).not.toBeVisible()
    })
  })

  test.describe('Fixed Amount Discount', () => {
    test('should show amount OFF for fixed discounts', async ({ page }) => {
      await page.route('**/api/v1/billing/validate-discount-code', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              valid: true,
              originalAmount: 1999,
              discountApplied: 500,
              discountedAmount: 1499,
              discountCode: { code: 'SAVE5', discountType: 'amount', discountValue: 500 },
            },
          }),
        })
      })

      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE5')

      await page.click('button:has-text("Upgrade to Tier 1")')

      await expect(page.locator('text=$5.00 OFF').or(page.locator('text=$5 OFF')).first()).toBeVisible()
    })
  })

  test.describe('Validation Hint', () => {
    test('should show hint to click on plan to validate', async ({ page }) => {
      await goToBilling(page)

      const discountInput = page.locator('input[placeholder*="discount"]')
      await discountInput.fill('SAVE20')

      // Should show hint
      await expect(page.locator('text=Click on a plan to validate')).toBeVisible()
    })
  })
})
