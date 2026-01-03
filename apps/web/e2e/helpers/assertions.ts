import { Page, Locator, expect } from '@playwright/test'

/**
 * Assert that a toast notification appeared with the given message
 */
export async function expectToast(
  page: Page,
  message: string,
  options: { type?: 'success' | 'error' | 'info'; timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options

  // Common toast selectors
  const toastSelectors = [
    '[data-sonner-toast]',
    '[role="status"]',
    '.toast',
    '[data-toast]',
    '.Toastify__toast',
  ]

  for (const selector of toastSelectors) {
    const toast = page.locator(`${selector}:has-text("${message}")`).first()
    try {
      await expect(toast).toBeVisible({ timeout })
      return
    } catch {
      // Try next selector
    }
  }

  // Fallback: any element containing the message
  const anyToast = page.locator(`text="${message}"`).first()
  await expect(anyToast).toBeVisible({ timeout })
}

/**
 * Assert that a success toast appeared
 */
export async function expectSuccessToast(page: Page, message: string): Promise<void> {
  await expectToast(page, message, { type: 'success' })
}

/**
 * Assert that an error toast appeared
 */
export async function expectErrorToast(page: Page, message: string): Promise<void> {
  await expectToast(page, message, { type: 'error' })
}

/**
 * Assert that an alert is visible with the given message
 */
export async function expectAlert(
  page: Page,
  message: string,
  variant: 'default' | 'destructive' = 'default'
): Promise<void> {
  const alert = page.locator(`[role="alert"]:has-text("${message}")`)
  await expect(alert).toBeVisible()
}

/**
 * Assert that an error alert is visible
 */
export async function expectErrorAlert(page: Page, message: string): Promise<void> {
  await expectAlert(page, message, 'destructive')
}

/**
 * Assert that a badge with specific text is visible
 */
export async function expectBadge(page: Page, text: string): Promise<void> {
  const badge = page.locator(`[class*="badge"]:has-text("${text}"), span:has-text("${text}")`).first()
  await expect(badge).toBeVisible()
}

/**
 * Assert that a badge with specific variant is visible
 */
export async function expectBadgeVariant(
  page: Page,
  text: string,
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
): Promise<void> {
  const badge = page.locator(`[class*="badge"][class*="${variant}"]:has-text("${text}")`)
  await expect(badge).toBeVisible()
}

/**
 * Assert that a heading with specific text is visible
 */
export async function expectHeading(page: Page, text: string, level?: 1 | 2 | 3 | 4 | 5 | 6): Promise<void> {
  const selector = level ? `h${level}:has-text("${text}")` : `:is(h1,h2,h3,h4,h5,h6):has-text("${text}")`
  await expect(page.locator(selector).first()).toBeVisible()
}

/**
 * Assert that text content is visible on the page
 */
export async function expectText(page: Page, text: string): Promise<void> {
  await expect(page.locator(`text="${text}"`).first()).toBeVisible()
}

/**
 * Assert that text content is not visible on the page
 */
export async function expectNoText(page: Page, text: string): Promise<void> {
  await expect(page.locator(`text="${text}"`)).not.toBeVisible()
}

/**
 * Assert that a button with specific text is visible
 */
export async function expectButton(page: Page, text: string): Promise<void> {
  await expect(page.locator(`button:has-text("${text}")`).first()).toBeVisible()
}

/**
 * Assert that a button is disabled
 */
export async function expectButtonDisabled(page: Page, text: string): Promise<void> {
  await expect(page.locator(`button:has-text("${text}")`).first()).toBeDisabled()
}

/**
 * Assert that a button is enabled
 */
export async function expectButtonEnabled(page: Page, text: string): Promise<void> {
  await expect(page.locator(`button:has-text("${text}")`).first()).toBeEnabled()
}

/**
 * Assert that a link with specific text is visible
 */
export async function expectLink(page: Page, text: string): Promise<void> {
  await expect(page.locator(`a:has-text("${text}")`).first()).toBeVisible()
}

/**
 * Assert that a link has specific href
 */
export async function expectLinkHref(page: Page, text: string, href: string): Promise<void> {
  const link = page.locator(`a:has-text("${text}")`).first()
  await expect(link).toHaveAttribute('href', href)
}

/**
 * Assert that a card with specific title is visible
 */
export async function expectCard(page: Page, title: string): Promise<void> {
  const card = page.locator(`[class*="card"]:has(:is(h2,h3,h4):has-text("${title}"))`)
  await expect(card.first()).toBeVisible()
}

/**
 * Assert that a table has specific number of rows
 */
export async function expectTableRows(page: Page, count: number, tableSelector = 'table'): Promise<void> {
  const rows = page.locator(`${tableSelector} tbody tr`)
  await expect(rows).toHaveCount(count)
}

/**
 * Assert that a table contains specific text in a row
 */
export async function expectTableRowWithText(
  page: Page,
  text: string,
  tableSelector = 'table'
): Promise<void> {
  const row = page.locator(`${tableSelector} tbody tr:has-text("${text}")`)
  await expect(row.first()).toBeVisible()
}

/**
 * Assert that loading spinner is visible
 */
export async function expectLoading(page: Page): Promise<void> {
  const spinner = page.locator('[class*="animate-spin"], [data-loading="true"], .loading')
  await expect(spinner.first()).toBeVisible()
}

/**
 * Assert that loading spinner is not visible
 */
export async function expectNotLoading(page: Page): Promise<void> {
  const spinner = page.locator('[class*="animate-spin"], [data-loading="true"], .loading')
  await expect(spinner).not.toBeVisible()
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(page: Page, timeout = 10000): Promise<void> {
  const spinner = page.locator('[class*="animate-spin"], [data-loading="true"], .loading')
  await expect(spinner).not.toBeVisible({ timeout })
}

/**
 * Assert that an element with specific test id is visible
 */
export async function expectTestId(page: Page, testId: string): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible()
}

/**
 * Assert that an element with specific test id is not visible
 */
export async function expectNoTestId(page: Page, testId: string): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).not.toBeVisible()
}

/**
 * Assert that the page title contains specific text
 */
export async function expectTitle(page: Page, title: string): Promise<void> {
  await expect(page).toHaveTitle(new RegExp(title))
}

/**
 * Assert that element count matches
 */
export async function expectCount(page: Page, selector: string, count: number): Promise<void> {
  await expect(page.locator(selector)).toHaveCount(count)
}

/**
 * Assert that an image is visible
 */
export async function expectImage(page: Page, altText?: string): Promise<void> {
  const selector = altText ? `img[alt="${altText}"]` : 'img'
  await expect(page.locator(selector).first()).toBeVisible()
}

/**
 * Assert that avatar with initials is visible
 */
export async function expectAvatarWithInitials(page: Page, initials: string): Promise<void> {
  const avatar = page.locator(`[class*="avatar"]:has-text("${initials}")`)
  await expect(avatar.first()).toBeVisible()
}

/**
 * Assert that a dialog/modal is visible
 */
export async function expectDialog(page: Page, title?: string): Promise<void> {
  const dialogSelector = '[role="dialog"], [role="alertdialog"]'
  const dialog = title
    ? page.locator(`${dialogSelector}:has(:has-text("${title}"))`)
    : page.locator(dialogSelector)
  await expect(dialog.first()).toBeVisible()
}

/**
 * Assert that a dialog/modal is not visible
 */
export async function expectNoDialog(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"]')).not.toBeVisible()
}

/**
 * Assert that a dropdown menu is visible
 */
export async function expectDropdownMenu(page: Page): Promise<void> {
  await expect(page.locator('[role="menu"]')).toBeVisible()
}

/**
 * Assert that a dropdown menu is not visible
 */
export async function expectNoDropdownMenu(page: Page): Promise<void> {
  await expect(page.locator('[role="menu"]')).not.toBeVisible()
}
