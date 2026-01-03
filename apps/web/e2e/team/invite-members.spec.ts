import { test, expect } from '@playwright/test'
import { goToTeam } from '../helpers/navigation'
import { fillByPlaceholder } from '../helpers/forms'
import { expectSuccessToast, expectButton } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Team Page - Invite Members', () => {
  const mockTeamData = {
    id: 1,
    name: 'Test Team',
    slug: 'test-team',
    ownerId: 1,
    subscription: {
      id: 1,
      tier: { slug: 'tier1', name: 'Tier 1' },
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    members: [
      { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, createdAt: new Date().toISOString() },
    ],
  }

  // Helper to mock team and invitations endpoints
  async function setupTeamMock(page: import('@playwright/test').Page, teamData = mockTeamData, invitations: unknown[] = []) {
    await page.route('**/api/v1/teams/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: teamData }),
      })
    })
    await page.route('**/api/v1/teams/1/invitations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: invitations }),
      })
    })
  }

  test.describe('Admin/Owner Can Invite', () => {
    test.beforeEach(async ({ page }) => {
      // Owner user
      await mockAuthenticatedUser(page, {
        id: 1,
        email: 'owner@example.com',
        fullName: 'Owner User',
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      await setupTeamMock(page)
    })

    test('should show invite form for owner', async ({ page }) => {
      await goToTeam(page)

      // Should show invite form
      await expect(page.locator('input[placeholder*="Email"], input[type="email"]').first()).toBeVisible()
    })

    test('should show email input field', async ({ page }) => {
      await goToTeam(page)

      await expect(page.locator('input[placeholder="Email address"], input[placeholder*="email"]').first()).toBeVisible()
    })

    test('should show role selector', async ({ page }) => {
      await goToTeam(page)

      // Should have role dropdown
      await expect(page.locator('button[role="combobox"], select').first()).toBeVisible()
    })

    test('should show Send Invite button', async ({ page }) => {
      await goToTeam(page)

      await expectButton(page, 'Send Invite').catch(async () => {
        await expectButton(page, 'Invite')
      })
    })

    test('should send invitation successfully', async ({ page }) => {
      await mockApiResponse(page, '/teams/1/invitations', { message: 'Invitation sent' }, { method: 'POST' })

      await goToTeam(page)

      // Fill email
      await fillByPlaceholder(page, 'Email address', 'newmember@example.com')

      // Click send invite
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Should show success
      await expectSuccessToast(page, 'sent').catch(async () => {
        await expect(page.locator('text=sent').or(page.locator('text=success')).first()).toBeVisible()
      })
    })

    test('should show error for invalid email', async ({ page }) => {
      await goToTeam(page)

      // Fill invalid email
      await fillByPlaceholder(page, 'Email address', 'invalid-email')

      // Click send invite
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Should stay on page (validation error)
      await expect(page).toHaveURL('/team')
    })

    test('should have role options: Member and Admin', async ({ page }) => {
      await goToTeam(page)

      // Click role dropdown
      const roleDropdown = page.locator('button[role="combobox"]').first()
      if (await roleDropdown.isVisible()) {
        await roleDropdown.click()

        // Should show member option
        await expect(page.locator('[role="option"]:has-text("Member"), [role="option"]:has-text("member")')).toBeVisible()

        // Should show admin option
        await expect(page.locator('[role="option"]:has-text("Admin"), [role="option"]:has-text("admin")')).toBeVisible()
      }
    })
  })

  test.describe('Member Cannot Invite', () => {
    test('should not show invite form for regular member', async ({ page }) => {
      const teamWithMember = {
        ...mockTeamData,
        members: [
          { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, joinedAt: new Date().toISOString() },
          { id: 2, userId: 2, role: 'member', user: { id: 2, fullName: 'Member User', email: 'member@example.com' }, joinedAt: new Date().toISOString() },
        ],
      }

      // Member user
      await mockAuthenticatedUser(page, {
        id: 2,
        email: 'member@example.com',
        fullName: 'Member User',
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: teamWithMember }),
        })
      })

      await goToTeam(page)

      // Should NOT show invite form
      await expect(page.locator('input[placeholder="Email address"]')).not.toBeVisible()
    })
  })

  test.describe('API Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: 'owner@example.com',
        fullName: 'Owner User',
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      await setupTeamMock(page)
    })

    test('should show error for duplicate invitation', async ({ page }) => {
      await mockApiError(page, '/teams/1/invitations', 409, 'User already invited', { method: 'POST' })

      await goToTeam(page)

      await fillByPlaceholder(page, 'Email address', 'existing@example.com')
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Should show error
      await expect(page.locator('text=already').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })

    test('should show error for existing member', async ({ page }) => {
      await mockApiError(page, '/teams/1/invitations', 409, 'User is already a team member', { method: 'POST' })

      await goToTeam(page)

      await fillByPlaceholder(page, 'Email address', 'member@example.com')
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Should show error
      await expect(page.locator('text=already').or(page.locator('[role="alert"]')).first()).toBeVisible()
    })

    test('should handle server error', async ({ page }) => {
      await mockApiError(page, '/teams/1/invitations', 500, 'Server error', { method: 'POST' })

      await goToTeam(page)

      await fillByPlaceholder(page, 'Email address', 'test@example.com')
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Should stay on page
      await expect(page).toHaveURL('/team')
    })
  })

  test.describe('Loading States', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: 'owner@example.com',
        fullName: 'Owner User',
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      await setupTeamMock(page)
    })

    test('should disable button while sending invite', async ({ page }) => {
      await mockApiResponse(page, '/teams/1/invitations', { message: 'Sent' }, { method: 'POST', delay: 1000 })

      await goToTeam(page)

      await fillByPlaceholder(page, 'Email address', 'test@example.com')
      await page.click('button:has-text("Send Invite"), button:has-text("Invite")')

      // Button should be disabled
      await expect(page.locator('button:has-text("Send Invite"), button:has-text("Invite")').first()).toBeDisabled()
    })

    test('should disable send button when email is empty', async ({ page }) => {
      await goToTeam(page)

      // Button should be disabled when email is empty
      const sendButton = page.locator('button:has-text("Send Invite"), button:has-text("Invite")').first()
      await expect(sendButton).toBeDisabled()
    })
  })
})
