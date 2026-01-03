import { Page, expect } from '@playwright/test'

/**
 * Navigate to a path with the base URL
 */
export async function goto(page: Page, path: string): Promise<void> {
  const url = path.startsWith('/') ? path : `/${path}`
  await page.goto(url)
}

/**
 * Wait for navigation to a specific path
 */
export async function waitForNavigation(
  page: Page,
  path: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options
  const url = path.startsWith('/') ? path : `/${path}`
  await page.waitForURL(`**${url}`, { timeout })
}

/**
 * Get current path without base URL
 */
export function getCurrentPath(page: Page): string {
  const url = new URL(page.url())
  return url.pathname
}

/**
 * Assert that the page has navigated to a specific path
 */
export async function expectPath(page: Page, path: string): Promise<void> {
  const expectedPath = path.startsWith('/') ? path : `/${path}`
  await expect(page).toHaveURL(new RegExp(`${expectedPath}$`))
}

/**
 * Assert redirect occurred to a specific path
 */
export async function expectRedirect(
  page: Page,
  expectedPath: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options
  await page.waitForURL(`**${expectedPath}`, { timeout })
  await expectPath(page, expectedPath)
}

/**
 * Navigate to login page
 */
export async function goToLogin(page: Page): Promise<void> {
  await goto(page, '/login')
  await expect(page).toHaveURL('/login')
}

/**
 * Navigate to register page
 */
export async function goToRegister(page: Page): Promise<void> {
  await goto(page, '/register')
  await expect(page).toHaveURL('/register')
}

/**
 * Navigate to dashboard
 */
export async function goToDashboard(page: Page): Promise<void> {
  await goto(page, '/dashboard')
}

/**
 * Navigate to profile page
 */
export async function goToProfile(page: Page): Promise<void> {
  await goto(page, '/profile')
}

/**
 * Navigate to security page
 */
export async function goToSecurity(page: Page): Promise<void> {
  await goto(page, '/profile/security')
}

/**
 * Navigate to settings page
 */
export async function goToSettings(page: Page): Promise<void> {
  await goto(page, '/profile/settings')
}

/**
 * Navigate to team page
 */
export async function goToTeam(page: Page): Promise<void> {
  await goto(page, '/team')
}

/**
 * Navigate to billing page
 */
export async function goToBilling(page: Page): Promise<void> {
  await goto(page, '/billing')
}

/**
 * Navigate to admin dashboard
 */
export async function goToAdminDashboard(page: Page): Promise<void> {
  await goto(page, '/admin/dashboard')
}

/**
 * Navigate to admin users page
 */
export async function goToAdminUsers(page: Page): Promise<void> {
  await goto(page, '/admin/users')
}

/**
 * Navigate to admin coupons page
 */
export async function goToAdminCoupons(page: Page): Promise<void> {
  await goto(page, '/admin/coupons')
}

/**
 * Navigate to admin discount codes page
 */
export async function goToAdminDiscountCodes(page: Page): Promise<void> {
  await goto(page, '/admin/discount-codes')
}

/**
 * Click a navigation link by text
 */
export async function clickNavLink(page: Page, text: string): Promise<void> {
  await page.click(`nav a:has-text("${text}")`)
}

/**
 * Click a menu item by text
 */
export async function clickMenuItem(page: Page, text: string): Promise<void> {
  await page.click(`[role="menuitem"]:has-text("${text}")`)
}

/**
 * Open user menu dropdown
 */
export async function openUserMenu(page: Page): Promise<void> {
  // Try data-testid first, then fallback to avatar/button
  const userMenuButton = page.locator('[data-testid="user-menu"]')
  if (await userMenuButton.isVisible()) {
    await userMenuButton.click()
  } else {
    // Fallback: click on avatar or last header button
    const avatarButton = page.locator('header button:has([class*="avatar"])')
    if (await avatarButton.isVisible()) {
      await avatarButton.click()
    } else {
      await page.locator('header button').last().click()
    }
  }
}

/**
 * Close any open dropdown/menu
 */
export async function closeDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
}
