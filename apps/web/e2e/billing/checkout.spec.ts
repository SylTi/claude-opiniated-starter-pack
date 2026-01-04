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
  test('starts checkout and lands on success page', async ({ page }) => {
    await login(page)

    await page.goto('/billing')
    const upgradeButton = page.getByRole('button', { name: /upgrade to/i }).first()
    await expect(upgradeButton).toBeVisible({
      timeout: 20000,
    })
    await upgradeButton.click()

    await page.waitForURL('**/billing/success*', { timeout: 15000 })
    await expect(page).toHaveURL(/\/billing\/success/, { timeout: 5000 })
    await expect(page.getByText(/payment successful/i)).toBeVisible({
      timeout: 10000,
    })
  })
})
