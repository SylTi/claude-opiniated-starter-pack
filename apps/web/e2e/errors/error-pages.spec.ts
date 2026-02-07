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

  const submitButton = page.locator('form').getByRole('button', { name: /sign in/i })
  await submitButton.click()

  // If still on login page after 5s, React hydration may not have been ready — retry click
  try {
    await page.waitForURL('**/dashboard', { timeout: 5000 })
  } catch {
    await submitButton.click()
    await page.waitForURL('**/dashboard', { timeout: 45000 })
  }
}

test.describe('Error Pages', () => {
  test('shows 404 page for unknown route', async ({ page }) => {
    await login(page)

    await page.goto('/this-page-does-not-exist')

    await expect(page.getByRole('heading', { name: /404/i })).toBeVisible()
    await expect(
      page.getByText(/page you are looking for does not exist/i)
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /go home/i })).toBeVisible()
  })
})
