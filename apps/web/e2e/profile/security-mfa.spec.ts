import { test, expect } from '@playwright/test'
import { goToSecurity } from '../helpers/navigation'
import { fillForm, submitForm } from '../helpers/forms'
import { expectSuccessToast, expectButton, expectBadge } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Security Page - MFA', () => {
  test.describe('MFA Disabled State', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })
    })

    test('should show Setup 2FA button', async ({ page }) => {
      await goToSecurity(page)

      await expectButton(page, 'Set up 2FA').catch(async () => {
        await expectButton(page, 'Enable 2FA')
      })
    })

    test('should show warning about 2FA not being enabled', async ({ page }) => {
      await goToSecurity(page)

      // Should show warning or disabled indicator
      await expect(page.locator('text=not enabled').or(page.locator('text=disabled')).or(page.locator('text=recommended')).first()).toBeVisible()
    })
  })

  test.describe('MFA Setup Flow', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      // Mock MFA setup endpoint
      await page.route('**/api/v1/mfa/setup', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              secret: 'JBSWY3DPEHPK3PXP',
              backupCodes: ['12345678', '23456789', '34567890', '45678901', '56789012', '67890123', '78901234', '89012345'],
            },
          }),
        })
      })
    })

    test('should show QR code when clicking setup', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should show QR code
      await expect(page.locator('img[src*="data:image"], img[alt*="QR"]').first()).toBeVisible()
    })

    test('should display backup codes', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should show backup codes
      await expect(page.locator('text=12345678').or(page.locator('text=Backup')).first()).toBeVisible()
    })

    test('should have copy backup codes button', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should have copy button
      await expect(page.locator('button:has-text("Copy")').first()).toBeVisible()
    })

    test('copy button should change text after copying', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Click copy
      const copyButton = page.locator('button:has-text("Copy")').first()
      await copyButton.click()

      // Should show "Copied" or similar
      await expect(page.locator('text=Copied').first()).toBeVisible()
    })

    test('should show MFA code input field', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should show code input
      await expect(page.locator('input#enableCode, input[name="code"]').first()).toBeVisible()
    })

    test('should have Enable 2FA button', async ({ page }) => {
      await goToSecurity(page)

      // Click setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should have enable button
      await expectButton(page, 'Enable 2FA').catch(async () => {
        await expectButton(page, 'Enable')
      })
    })
  })

  test.describe('Enable MFA', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })

      // Mock MFA setup
      await page.route('**/api/v1/mfa/setup', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              qrCode: 'data:image/png;base64,test',
              secret: 'JBSWY3DPEHPK3PXP',
              backupCodes: ['12345678', '23456789'],
            },
          }),
        })
      })
    })

    test('should enable MFA with valid code', async ({ page }) => {
      // Mock enable endpoint
      await mockApiResponse(page, '/mfa/enable', { message: 'MFA enabled' }, { method: 'POST' })

      await goToSecurity(page)

      // Setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Enter code
      await page.fill('input#enableCode, input[name="code"]', '123456')
      await page.click('button:has-text("Enable 2FA"), button:has-text("Enable")')

      // Should show success
      await expectSuccessToast(page, 'enabled').catch(async () => {
        await expect(page.locator('text=enabled').or(page.locator('text=success')).first()).toBeVisible()
      })
    })

    test('should show error for invalid code', async ({ page }) => {
      // Mock error
      await mockApiError(page, '/mfa/enable', 401, 'Invalid code', { method: 'POST' })

      await goToSecurity(page)

      // Setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Enter wrong code
      await page.fill('input#enableCode, input[name="code"]', '000000')
      await page.click('button:has-text("Enable 2FA"), button:has-text("Enable")')

      // Should show error
      await expect(page.locator('text=Invalid').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })

    test('should have cancel button during setup', async ({ page }) => {
      await goToSecurity(page)

      // Setup 2FA
      await page.click('button:has-text("Set up 2FA"), button:has-text("Enable 2FA")')

      // Should have cancel button
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible()
    })
  })

  test.describe('MFA Enabled State', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })
    })

    test('should show Protected badge or enabled status', async ({ page }) => {
      await goToSecurity(page)

      // Should show enabled status
      await expect(page.locator('text=enabled').or(page.locator('text=Protected')).first()).toBeVisible()
    })

    test('should show Disable 2FA button', async ({ page }) => {
      await goToSecurity(page)

      // Should have disable button
      await expectButton(page, 'Disable 2FA').catch(async () => {
        await expectButton(page, 'Disable')
      })
    })

    test('should show backup codes remaining', async ({ page }) => {
      await goToSecurity(page)

      // May show backup codes remaining
      await expect(page.locator('text=Backup').or(page.locator('text=codes')).first()).toBeVisible()
    })
  })

  test.describe('Disable MFA', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.regular.email,
        fullName: TEST_USERS.regular.fullName,
        role: 'user',
        subscriptionTier: 'free',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: null,
        createdAt: new Date().toISOString(),
      })
    })

    test('should show code input when clicking disable', async ({ page }) => {
      await goToSecurity(page)

      // Click disable
      await page.click('button:has-text("Disable 2FA"), button:has-text("Disable")')

      // Should show code input
      await expect(page.locator('input#disableCode, input[name="code"]').first()).toBeVisible()
    })

    test('should disable MFA with valid code', async ({ page }) => {
      await mockApiResponse(page, '/mfa/disable', { message: 'MFA disabled' }, { method: 'POST' })

      await goToSecurity(page)

      // Click disable
      await page.click('button:has-text("Disable 2FA"), button:has-text("Disable")')

      // Enter code
      await page.fill('input#disableCode, input[name="code"]', '123456')
      await page.click('button:has-text("Disable"):not(:has-text("2FA")), button[type="submit"]')

      // Should show success
      await expectSuccessToast(page, 'disabled').catch(async () => {
        await expect(page.locator('text=disabled').or(page.locator('text=success')).first()).toBeVisible()
      })
    })

    test('should show error for invalid disable code', async ({ page }) => {
      await mockApiError(page, '/mfa/disable', 401, 'Invalid code', { method: 'POST' })

      await goToSecurity(page)

      // Click disable
      await page.click('button:has-text("Disable 2FA"), button:has-text("Disable")')

      // Enter wrong code
      await page.fill('input#disableCode, input[name="code"]', '000000')
      await page.click('button:has-text("Disable"):not(:has-text("2FA")), button[type="submit"]')

      // Should show error
      await expect(page.locator('text=Invalid').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })
  })
})
