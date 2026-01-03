import { test as base, Page } from '@playwright/test'

/**
 * Test user credentials for different roles and tiers
 */
export const TEST_USERS = {
  regular: {
    email: 'test@example.com',
    password: 'password123',
    fullName: 'Test User',
  },
  admin: {
    email: 'admin@example.com',
    password: 'password123',
    fullName: 'Admin User',
  },
  tier1: {
    email: 'tier1@example.com',
    password: 'password123',
    fullName: 'Tier 1 User',
  },
  tier2: {
    email: 'tier2@example.com',
    password: 'password123',
    fullName: 'Tier 2 User',
  },
  mfaEnabled: {
    email: 'mfa@example.com',
    password: 'password123',
    fullName: 'MFA User',
  },
} as const

/**
 * Login as a regular user
 */
export async function loginAsUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('input#email', TEST_USERS.regular.email)
  await page.fill('input#password', TEST_USERS.regular.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/**
 * Login as an admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('input#email', TEST_USERS.admin.email)
  await page.fill('input#password', TEST_USERS.admin.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/**
 * Login as a tier1 subscriber
 */
export async function loginAsTier1User(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('input#email', TEST_USERS.tier1.email)
  await page.fill('input#password', TEST_USERS.tier1.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/**
 * Login as a tier2 subscriber
 */
export async function loginAsTier2User(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('input#email', TEST_USERS.tier2.email)
  await page.fill('input#password', TEST_USERS.tier2.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Click on user menu/avatar to open dropdown
  await page.click('[data-testid="user-menu"]').catch(async () => {
    // Fallback: try clicking on avatar or user button
    await page.click('button:has([class*="avatar"])').catch(async () => {
      await page.click('header button:last-child')
    })
  })

  // Click logout button
  await page.click('button:has-text("Logout")').catch(async () => {
    await page.click('[role="menuitem"]:has-text("Logout")')
  })

  await page.waitForURL('/login')
}

/**
 * Check if user is authenticated by looking for dashboard elements
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('/dashboard')
    await page.waitForURL('/dashboard', { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Extended test fixture with authentication helpers
 */
type AuthFixtures = {
  authenticatedPage: Page
  adminPage: Page
  tier1Page: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginAsUser(page)
    await use(page)
  },
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page)
    await use(page)
  },
  tier1Page: async ({ page }, use) => {
    await loginAsTier1User(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
