import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/')

    // Verify page is loaded
    await expect(page).toHaveURL('/')
  })
})

test.describe('Authentication Pages', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login')

    // Verify login page is loaded
    await expect(page).toHaveURL('/login')
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/register')

    // Verify register page is loaded
    await expect(page).toHaveURL('/register')
  })

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/forgot-password')

    // Verify forgot password page is loaded
    await expect(page).toHaveURL('/forgot-password')
  })
})
