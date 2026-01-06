import { test, expect } from '@playwright/test'

const FORGED_COOKIE = {
  name: 'user-info',
  value: 'forged-cookie',
  domain: 'localhost',
  path: '/',
}

test.describe('Forged user cookie protection', () => {
  const protectedRoutes = [
    '/dashboard',
    '/profile',
    '/profile/security',
    '/profile/settings',
    '/team',
    '/billing',
    '/billing/success',
    '/billing/cancel',
    '/admin/dashboard',
    '/admin/users',
    '/admin/tiers',
    '/admin/coupons',
    '/admin/discount-codes',
  ]

  for (const route of protectedRoutes) {
    test(`rejects forged cookie for ${route}`, async ({ page }) => {
      await page.context().clearCookies()
      await page.context().addCookies([FORGED_COOKIE])
      await page.goto(route)

      const encoded = encodeURIComponent(route)
      await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encoded}$`), {
        timeout: 10000,
      })
    })
  }
})
