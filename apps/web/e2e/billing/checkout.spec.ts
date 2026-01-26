import { test, expect, type Page } from '@playwright/test'

const TEST_USER = {
  email: 'free@test.com',
  password: 'password123',
} as const

async function login(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(TEST_USER.email)
  await page.getByLabel(/password/i).fill(TEST_USER.password)
  await page.locator('form').getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
}

test.describe('Billing Checkout', () => {
  /**
   * NOTE: This test requires real Stripe test credentials to work.
   * It verifies the full checkout flow including Stripe redirect.
   *
   * To run this test:
   * 1. Set STRIPE_SECRET_KEY in .env.test to a real Stripe test key (sk_test_...)
   * 2. Configure the webhook secret and other Stripe settings
   *
   * The test is skipped by default when using placeholder credentials.
   */
  test('starts checkout and lands on success page', async ({ page }) => {
    // Skip this test when Stripe is not properly configured
    // The test requires real Stripe test credentials for the checkout flow
    test.skip(
      !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder'),
      'Skipping: Stripe test credentials not configured. Set real STRIPE_SECRET_KEY in .env.test to run this test.'
    )

    await login(page)

    await page.goto('/billing')
    const upgradeButton = page.getByRole('button', { name: /upgrade to/i }).first()
    await expect(upgradeButton).toBeVisible({
      timeout: 20000,
    })
    await upgradeButton.click()

    // Wait for Stripe redirect and return to success page
    await page.waitForURL('**/billing/success*', { timeout: 30000 })
    await expect(page).toHaveURL(/\/billing\/success/, { timeout: 5000 })
    await expect(page.getByText(/payment successful/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('displays billing page with available plans', async ({ page }) => {
    await login(page)

    await page.goto('/billing')

    // Verify billing page loads with plans
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /available plans/i })).toBeVisible()

    // Verify at least one upgrade button is visible
    const upgradeButtons = page.getByRole('button', { name: /upgrade to/i })
    await expect(upgradeButtons.first()).toBeVisible({ timeout: 10000 })
  })
})
