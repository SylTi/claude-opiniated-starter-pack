import { test, expect } from '@playwright/test'
import { goToTeam } from '../helpers/navigation'
import { expectSuccessToast, expectBadge, expectDialog } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Team Page - Pending Invitations', () => {
  const mockTeamWithInvitations = {
    id: 1,
    name: 'Test Team',
    slug: 'test-team',
    tier: 'tier1',
    members: [
      { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, joinedAt: new Date().toISOString() },
    ],
    invitations: [
      { id: 1, email: 'pending1@example.com', role: 'member', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() },
      { id: 2, email: 'pending2@example.com', role: 'admin', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() },
    ],
  }

  test.describe('Invitations Table Display', () => {
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

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTeamWithInvitations }),
        })
      })
    })

    test('should display pending invitations section', async ({ page }) => {
      await goToTeam(page)

      // Should show pending invitations
      await expect(page.locator('text=Pending').or(page.locator('text=Invitation')).first()).toBeVisible()
    })

    test('should show invited email addresses', async ({ page }) => {
      await goToTeam(page)

      // Should show invitation emails
      await expect(page.locator('text=pending1@example.com')).toBeVisible()
      await expect(page.locator('text=pending2@example.com')).toBeVisible()
    })

    test('should show role badge for each invitation', async ({ page }) => {
      await goToTeam(page)

      // Should show role badges
      await expect(page.locator('text=Member').or(page.locator('text=member')).first()).toBeVisible()
      await expect(page.locator('text=Admin').or(page.locator('text=admin')).first()).toBeVisible()
    })

    test('should show expiration date', async ({ page }) => {
      await goToTeam(page)

      // Should show expiration info
      await expect(page.locator('text=Expires').or(page.locator('text=expires')).or(page.locator('time')).first()).toBeVisible()
    })

    test('should show delete button for each invitation', async ({ page }) => {
      await goToTeam(page)

      // Should have delete buttons (trash icons)
      const deleteButtons = page.locator('button:has(svg[class*="trash"]), button:has-text("Delete"), button[aria-label*="delete"], button[aria-label*="cancel"]')
      expect(await deleteButtons.count()).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('Delete Invitation', () => {
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

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTeamWithInvitations }),
        })
      })
    })

    test('should show confirmation dialog when clicking delete', async ({ page }) => {
      await goToTeam(page)

      // Click delete button
      const deleteButton = page.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"], button[aria-label*="cancel"]').first()
      await deleteButton.click()

      // Should show confirmation dialog
      await expectDialog(page)
    })

    test('should cancel invitation after confirmation', async ({ page }) => {
      await mockApiResponse(page, '/teams/1/invitations/1', { message: 'Invitation cancelled' }, { method: 'DELETE' })

      await goToTeam(page)

      // Click delete button
      const deleteButton = page.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"], button[aria-label*="cancel"]').first()
      await deleteButton.click()

      // Confirm
      await page.click('button:has-text("Cancel Invitation"), button:has-text("Confirm"), button:has-text("Delete")')

      // Should show success
      await expectSuccessToast(page, 'cancelled').catch(async () => {
        await expect(page.locator('text=cancelled').or(page.locator('text=deleted')).first()).toBeVisible()
      })
    })

    test('should handle delete error', async ({ page }) => {
      await mockApiError(page, '/teams/1/invitations/1', 500, 'Failed to cancel invitation', { method: 'DELETE' })

      await goToTeam(page)

      // Click delete button
      const deleteButton = page.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"], button[aria-label*="cancel"]').first()
      await deleteButton.click()

      // Confirm
      await page.click('button:has-text("Cancel Invitation"), button:has-text("Confirm"), button:has-text("Delete")')

      // Should show error or stay on page
      await expect(page).toHaveURL('/team')
    })
  })

  test.describe('No Pending Invitations', () => {
    test('should not show invitations section when none exist', async ({ page }) => {
      const teamNoInvitations = {
        ...mockTeamWithInvitations,
        invitations: [],
      }

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

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: teamNoInvitations }),
        })
      })

      await goToTeam(page)

      // Should not show invitations table (or show empty state)
      await expect(page.locator('text=pending1@example.com')).not.toBeVisible()
    })
  })

  test.describe('Non-Admin View', () => {
    test('should not show pending invitations for regular member', async ({ page }) => {
      const teamWithMember = {
        ...mockTeamWithInvitations,
        members: [
          { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, joinedAt: new Date().toISOString() },
          { id: 2, userId: 2, role: 'member', user: { id: 2, fullName: 'Member User', email: 'member@example.com' }, joinedAt: new Date().toISOString() },
        ],
      }

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

      // Should NOT show pending invitations section
      await expect(page.locator('text=pending1@example.com')).not.toBeVisible()
    })
  })

  test.describe('Confirmation Dialog', () => {
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

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTeamWithInvitations }),
        })
      })
    })

    test('should close dialog on cancel', async ({ page }) => {
      await goToTeam(page)

      // Click delete
      const deleteButton = page.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"], button[aria-label*="cancel"]').first()
      await deleteButton.click()

      // Should show dialog
      await expectDialog(page)

      // Click cancel
      await page.click('button:has-text("Cancel"):not(:has-text("Invitation")), button:has-text("No")')

      // Dialog should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    })

    test('should show email in confirmation message', async ({ page }) => {
      await goToTeam(page)

      // Click delete for first invitation
      const deleteButton = page.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"], button[aria-label*="cancel"]').first()
      await deleteButton.click()

      // Should show email in dialog
      await expect(page.locator('[role="dialog"]:has-text("pending")')).toBeVisible()
    })
  })
})
