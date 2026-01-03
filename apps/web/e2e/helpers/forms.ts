import { Page, Locator, expect } from '@playwright/test'

/**
 * Fill a form with the given field values
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string>
): Promise<void> {
  for (const [fieldId, value] of Object.entries(fields)) {
    const input = page.locator(`input#${fieldId}, textarea#${fieldId}`)
    await input.fill(value)
  }
}

/**
 * Fill a form field by its ID
 */
export async function fillField(page: Page, fieldId: string, value: string): Promise<void> {
  await page.fill(`input#${fieldId}, textarea#${fieldId}`, value)
}

/**
 * Fill a form field by placeholder
 */
export async function fillByPlaceholder(
  page: Page,
  placeholder: string,
  value: string
): Promise<void> {
  await page.fill(`input[placeholder="${placeholder}"]`, value)
}

/**
 * Clear a form field by its ID
 */
export async function clearField(page: Page, fieldId: string): Promise<void> {
  await page.fill(`input#${fieldId}, textarea#${fieldId}`, '')
}

/**
 * Submit a form by clicking the submit button
 */
export async function submitForm(page: Page, buttonText?: string): Promise<void> {
  if (buttonText) {
    // Use type="submit" to avoid clicking nav buttons with the same text
    await page.click(`button[type="submit"]:has-text("${buttonText}")`)
  } else {
    await page.click('button[type="submit"]')
  }
}

/**
 * Get validation error message for a field
 */
export async function getValidationError(page: Page, fieldId: string): Promise<string | null> {
  // Try common error patterns
  const patterns = [
    `#${fieldId} + p`, // Sibling paragraph
    `#${fieldId} ~ p`, // Following sibling paragraph
    `label[for="${fieldId}"] + * p`, // After label container
    `[data-field="${fieldId}"] [role="alert"]`, // Data attribute
    `.field-error-${fieldId}`, // Class-based
  ]

  for (const pattern of patterns) {
    const element = page.locator(pattern).first()
    if (await element.isVisible()) {
      return await element.textContent()
    }
  }

  // Fallback: look for any visible error near the field
  const fieldContainer = page.locator(`input#${fieldId}`).locator('..')
  const error = fieldContainer.locator('p.text-destructive, p.text-red-500, [role="alert"]').first()
  if (await error.isVisible()) {
    return await error.textContent()
  }

  return null
}

/**
 * Check if a field has a validation error
 */
export async function hasValidationError(page: Page, fieldId: string): Promise<boolean> {
  const error = await getValidationError(page, fieldId)
  return error !== null
}

/**
 * Assert that a field has a specific validation error
 */
export async function expectValidationError(
  page: Page,
  fieldId: string,
  expectedMessage?: string
): Promise<void> {
  const error = await getValidationError(page, fieldId)
  expect(error).not.toBeNull()
  if (expectedMessage) {
    expect(error).toContain(expectedMessage)
  }
}

/**
 * Assert that a field has no validation error
 */
export async function expectNoValidationError(page: Page, fieldId: string): Promise<void> {
  const error = await getValidationError(page, fieldId)
  expect(error).toBeNull()
}

/**
 * Wait for form to be submitting (button disabled, loading)
 */
export async function waitForSubmitting(page: Page, buttonText?: string): Promise<void> {
  const button = buttonText
    ? page.locator(`button:has-text("${buttonText}")`)
    : page.locator('button[type="submit"]')
  await expect(button).toBeDisabled()
}

/**
 * Wait for form to finish submitting (button enabled again)
 */
export async function waitForSubmitComplete(page: Page, buttonText?: string): Promise<void> {
  const button = buttonText
    ? page.locator(`button:has-text("${buttonText}")`)
    : page.locator('button[type="submit"]')
  await expect(button).toBeEnabled()
}

/**
 * Check if submit button is disabled
 */
export async function isSubmitDisabled(page: Page, buttonText?: string): Promise<boolean> {
  const button = buttonText
    ? page.locator(`button:has-text("${buttonText}")`)
    : page.locator('button[type="submit"]')
  return await button.isDisabled()
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(
  page: Page,
  selectId: string,
  value: string
): Promise<void> {
  await page.selectOption(`select#${selectId}`, value)
}

/**
 * Select an option from a shadcn Select component
 */
export async function selectShadcnOption(
  page: Page,
  triggerText: string,
  optionText: string
): Promise<void> {
  // Click the select trigger
  await page.click(`button[role="combobox"]:has-text("${triggerText}")`)
  // Wait for dropdown and click option
  await page.click(`[role="option"]:has-text("${optionText}")`)
}

/**
 * Get the value of a form field
 */
export async function getFieldValue(page: Page, fieldId: string): Promise<string> {
  return await page.inputValue(`input#${fieldId}, textarea#${fieldId}`)
}

/**
 * Check if a field is disabled
 */
export async function isFieldDisabled(page: Page, fieldId: string): Promise<boolean> {
  const input = page.locator(`input#${fieldId}, textarea#${fieldId}`)
  return await input.isDisabled()
}

/**
 * Assert that a field is disabled
 */
export async function expectFieldDisabled(page: Page, fieldId: string): Promise<void> {
  const input = page.locator(`input#${fieldId}, textarea#${fieldId}`)
  await expect(input).toBeDisabled()
}

/**
 * Assert that a field is enabled
 */
export async function expectFieldEnabled(page: Page, fieldId: string): Promise<void> {
  const input = page.locator(`input#${fieldId}, textarea#${fieldId}`)
  await expect(input).toBeEnabled()
}

/**
 * Assert that a field has a specific value
 */
export async function expectFieldValue(
  page: Page,
  fieldId: string,
  expectedValue: string
): Promise<void> {
  const input = page.locator(`input#${fieldId}, textarea#${fieldId}`)
  await expect(input).toHaveValue(expectedValue)
}

/**
 * Check a checkbox by its ID
 */
export async function checkCheckbox(page: Page, checkboxId: string): Promise<void> {
  await page.check(`input#${checkboxId}`)
}

/**
 * Uncheck a checkbox by its ID
 */
export async function uncheckCheckbox(page: Page, checkboxId: string): Promise<void> {
  await page.uncheck(`input#${checkboxId}`)
}

/**
 * Get all form field IDs on the page
 */
export async function getFormFieldIds(page: Page): Promise<string[]> {
  const inputs = await page.locator('input[id], textarea[id]').all()
  const ids: string[] = []
  for (const input of inputs) {
    const id = await input.getAttribute('id')
    if (id) ids.push(id)
  }
  return ids
}
