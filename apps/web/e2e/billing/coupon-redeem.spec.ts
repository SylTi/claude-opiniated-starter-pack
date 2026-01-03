import { test, expect } from '@playwright/test'
import { goToBilling } from '../helpers/navigation'
import { expectSuccessToast } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Billing Page - Coupon Redemption', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'tier1' as const,
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
        body: JSON.stringify({ data: { subscription: null, canManage: true, hasPaymentMethod: false } }),
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

  test.describe('Coupon Card Display', () => {
    test('should display coupon redemption card', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('text=Redeem Coupon')).toBeVisible()
    })

    test('should show coupon input field', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('input[placeholder*="coupon"]')).toBeVisible()
    })

    test('should show Redeem button', async ({ page }) => {
      await goToBilling(page)

      await expect(page.locator('button:has-text("Redeem")')).toBeVisible()
    })

    test('should disable Redeem button when input is empty', async ({ page }) => {
      await goToBilling(page)

      const redeemButton = page.locator('button:has-text("Redeem")')
      await expect(redeemButton).toBeDisabled()
    })

    test('should show gift icon', async ({ page }) => {
      await goToBilling(page)

      // Gift icon should be visible
      const giftIcon = page.locator('text=Redeem Coupon').locator('..').locator('svg')
      await expect(giftIcon.first()).toBeVisible()
    })
  })

  test.describe('Coupon Input Behavior', () => {
    test('should convert input to uppercase', async ({ page }) => {
      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('abc123')

      await expect(couponInput).toHaveValue('ABC123')
    })

    test('should enable Redeem button when code is entered', async ({ page }) => {
      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('TESTCODE')

      const redeemButton = page.locator('button:has-text("Redeem")')
      await expect(redeemButton).toBeEnabled()
    })
  })

  test.describe('Valid Coupon Redemption', () => {
    test('should redeem valid coupon successfully', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')

      await page.click('button:has-text("Redeem")')

      // Should show success message
      await expect(page.locator('text=Coupon Redeemed!')).toBeVisible()
    })

    test('should display credited amount after redemption', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 5000,
              currency: 'usd',
              newBalance: 5000,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID50')

      await page.click('button:has-text("Redeem")')

      // Should show amount added (may appear in multiple places)
      await expect(page.getByText('$50.00').first()).toBeVisible()
    })

    test('should display new balance after redemption', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 7500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('BONUS25')

      await page.click('button:has-text("Redeem")')

      // Should show new balance
      await expect(page.locator('text=New balance')).toBeVisible()
      await expect(page.locator('text=$75.00')).toBeVisible()
    })

    test('should show "Redeem another coupon" link after success', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')

      await page.click('button:has-text("Redeem")')

      await expect(page.locator('text=Redeem another coupon')).toBeVisible()
    })

    test('should reset form when clicking "Redeem another"', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')

      await page.click('button:has-text("Redeem")')

      // Click redeem another
      await page.click('text=Redeem another coupon')

      // Should show input again
      await expect(page.locator('input[placeholder*="coupon"]')).toBeVisible()
    })
  })

  test.describe('Invalid Coupon', () => {
    test('should show error for invalid coupon code', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'BadRequest',
            message: 'Invalid coupon code',
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('INVALID')

      await page.click('button:has-text("Redeem")')

      // Should show error toast or message
      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=Invalid')).first()).toBeVisible()
    })

    test('should show error for expired coupon', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'BadRequest',
            message: 'Coupon has expired',
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('EXPIRED')

      await page.click('button:has-text("Redeem")')

      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=expired')).first()).toBeVisible()
    })

    test('should show error for already used coupon', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'BadRequest',
            message: 'Coupon already redeemed',
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('USED')

      await page.click('button:has-text("Redeem")')

      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"]').or(page.locator('text=already')).first()).toBeVisible()
    })
  })

  test.describe('Loading State', () => {
    test('should show loading state while redeeming', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')

      await page.click('button:has-text("Redeem")')

      // Should show loading text
      await expect(page.locator('text=Redeeming')).toBeVisible()
    })

    test('should disable input while redeeming', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')

      await page.click('button:has-text("Redeem")')

      // Input should be disabled
      await expect(couponInput).toBeDisabled()
    })
  })

  test.describe('Keyboard Submit', () => {
    test('should submit on Enter key press', async ({ page }) => {
      await page.route('**/api/v1/billing/redeem-coupon', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Coupon redeemed successfully!',
              creditAmount: 2500,
              currency: 'usd',
              newBalance: 2500,
            },
          }),
        })
      })

      await goToBilling(page)

      const couponInput = page.locator('input[placeholder*="coupon"]')
      await couponInput.fill('VALID25')
      await couponInput.press('Enter')

      // Should show success
      await expect(page.locator('text=Coupon Redeemed!')).toBeVisible()
    })
  })
})
