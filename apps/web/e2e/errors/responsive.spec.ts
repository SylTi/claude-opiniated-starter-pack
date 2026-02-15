import { test, expect } from '@playwright/test'

test.describe('Responsive Layout', () => {
  test('shows header on mobile viewport', async ({ page }) => {
    await page.context().clearCookies()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await expect(page.getByRole('link', { name: /saas/i })).toBeVisible()
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    })
    await expect(header.getByRole('link', { name: /get started/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('shows header on desktop viewport', async ({ page }) => {
    await page.context().clearCookies()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')

    await expect(page.getByRole('link', { name: /saas/i })).toBeVisible()
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    })
    await expect(header.getByRole('link', { name: /get started/i })).toBeVisible({
      timeout: 10000,
    })
  })
})
