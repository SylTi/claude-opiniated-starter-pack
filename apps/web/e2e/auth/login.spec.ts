import { test, expect, type Page } from '@playwright/test'

const TEST_USER = {
  email: 'free@test.com',
  password: 'password123',
} as const

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.locator('form').getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
}

test.describe('Login Page', () => {
  test('logs in with valid credentials and reaches dashboard', async ({ page }) => {
    await page.context().clearCookies()
    await login(page, TEST_USER.email, TEST_USER.password)

    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    await expect(page.getByTestId('user-menu')).toBeVisible()
  })
})
