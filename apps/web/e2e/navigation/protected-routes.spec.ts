import { test, expect, type Page } from '@playwright/test'

const USERS = {
  free: { email: 'free@test.com', password: 'password123' },
  teamOwner: { email: 'owner@test.com', password: 'password123' },
  admin: { email: 'admin@test.com', password: 'password123' },
} as const

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.locator('form').getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 20000 })
}

test.describe('Protected Routes', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/returnTo=%2Fdashboard/)

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/returnTo=%2Fprofile/)
  })

  test('blocks regular users from admin routes', async ({ page }) => {
    await login(page, USERS.free)

    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })

  test('blocks free users from team page', async ({ page }) => {
    await login(page, USERS.free)

    await page.goto('/team')
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })

  test('allows team owner to access team page', async ({ page }) => {
    await login(page, USERS.teamOwner)

    await page.goto('/team')
    await expect(page).toHaveURL('/team', { timeout: 10000 })
  })

  test('allows admin users to access admin dashboard', async ({ page }) => {
    await login(page, USERS.admin)

    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL('/admin/dashboard', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
  })
})
