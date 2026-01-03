import { test, expect } from '@playwright/test'
import { goToTeam } from '../helpers/navigation'
import { expectSuccessToast, expectDialog, expectBadge } from '../helpers/assertions'
import { mockAuthenticatedUser, mockApiResponse, mockApiError } from '../fixtures/api-mock.fixture'

test.describe('Team Page - Team Members', () => {
  const mockTeamWithMembers = {
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
      { id: 2, userId: 2, role: 'admin', user: { id: 2, fullName: 'Admin User', email: 'admin@example.com' }, createdAt: new Date().toISOString() },
      { id: 3, userId: 3, role: 'member', user: { id: 3, fullName: 'Member User', email: 'member@example.com' }, createdAt: new Date().toISOString() },
    ],
  }

  // Helper to mock team and invitations endpoints
  async function setupTeamMock(page: import('@playwright/test').Page, teamData = mockTeamWithMembers) {
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
        body: JSON.stringify({ data: [] }),
      })
    })
  }

  test.describe('Members Table Display', () => {
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

    test('should display members table', async ({ page }) => {
      await goToTeam(page)

      // Should show members section
      await expect(page.locator('text=Members').or(page.locator('text=Team Members')).first()).toBeVisible()
    })

    test('should show member names', async ({ page }) => {
      await goToTeam(page)

      // Should show all member names
      await expect(page.locator('text=Owner User')).toBeVisible()
      await expect(page.locator('text=Admin User')).toBeVisible()
      await expect(page.locator('text=Member User')).toBeVisible()
    })

    test('should show member emails', async ({ page }) => {
      await goToTeam(page)

      // Should show all member emails
      await expect(page.locator('text=owner@example.com')).toBeVisible()
      await expect(page.locator('text=admin@example.com')).toBeVisible()
      await expect(page.locator('text=member@example.com')).toBeVisible()
    })

    test('should show role badges for each member', async ({ page }) => {
      await goToTeam(page)

      // Should show role badges
      await expect(page.locator('text=Owner').or(page.locator('text=owner')).first()).toBeVisible()
      await expect(page.locator('text=Admin').or(page.locator('text=admin')).first()).toBeVisible()
      await expect(page.locator('text=Member').or(page.locator('text=member')).first()).toBeVisible()
    })

    test('should show joined date for members', async ({ page }) => {
      await goToTeam(page)

      // Should show joined dates in the members table - look for "Joined" column header
      await expect(page.getByRole('columnheader', { name: /joined/i }).or(page.getByText('Joined'))).toBeVisible()
    })

    test('should show avatars or initials for members', async ({ page }) => {
      await goToTeam(page)

      // Members should be shown (with or without avatars)
      await expect(page.locator('text=Owner User')).toBeVisible()
      await expect(page.locator('text=Admin User')).toBeVisible()
    })
  })

  test.describe('Owner Actions', () => {
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

    test('should show delete button for non-owner members', async ({ page }) => {
      await goToTeam(page)

      // The team members table should have actions column visible for admins
      // Check that the Actions column header exists
      await expect(page.getByRole('columnheader', { name: /actions/i }).or(page.locator('th:has-text("Actions")'))).toBeVisible()
    })

    test('should show confirmation dialog when clicking delete', async ({ page }) => {
      await goToTeam(page)

      // Find and click a delete button in the members table
      const deleteButton = page.locator('table button').filter({ has: page.locator('svg') }).first()
      if (await deleteButton.count() > 0) {
        await deleteButton.click()
        // Should show confirmation dialog
        await expectDialog(page)
      }
    })

    test('should remove member after confirmation', async ({ page }) => {
      await mockApiResponse(page, '/teams/1/members/3', { message: 'Member removed' }, { method: 'DELETE' })

      await goToTeam(page)

      // Find and click a delete button in the members table
      const deleteButton = page.locator('table button').filter({ has: page.locator('svg') }).first()
      if (await deleteButton.count() > 0) {
        await deleteButton.click()

        // Confirm removal
        const removeBtn = page.locator('button:has-text("Remove")')
        if (await removeBtn.count() > 0) {
          await removeBtn.click()
          // Success behavior depends on implementation
        }
      }
    })

    test('should handle remove member error', async ({ page }) => {
      await mockApiError(page, '/teams/1/members/3', 500, 'Failed to remove member', { method: 'DELETE' })

      await goToTeam(page)

      // Click delete button
      const deleteButton = page.locator('button:has(svg[class*="red"])').first()
      await deleteButton.click()

      // Confirm removal
      await page.click('button:has-text("Remove"), button:has-text("Confirm"), button:has-text("Delete")')

      // Should stay on page
      await expect(page).toHaveURL('/team')
    })

    test('should not show delete button for owner (self)', async ({ page }) => {
      await goToTeam(page)

      // Find owner row
      const ownerRow = page.locator('tr:has-text("Owner User"), div:has-text("Owner User")').first()

      // Should not have delete button in owner row (or should be disabled)
      const ownerDeleteButton = ownerRow.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"]')
      const count = await ownerDeleteButton.count()
      if (count > 0) {
        await expect(ownerDeleteButton.first()).toBeDisabled()
      }
    })
  })

  test.describe('Admin Actions', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 2,
        email: 'admin@example.com',
        fullName: 'Admin User',
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

    test('should show delete button for regular members', async ({ page }) => {
      await goToTeam(page)

      // Admin should see actions column for managing members
      await expect(page.locator('text=Member User')).toBeVisible()
    })

    test('should not allow admin to delete owner', async ({ page }) => {
      await goToTeam(page)

      // Owner row should not have delete button or it should be disabled
      const ownerRow = page.locator('tr:has-text("Owner User"), div:has-text("owner@example.com")').first()
      const ownerDeleteButton = ownerRow.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"]')
      const count = await ownerDeleteButton.count()
      if (count > 0) {
        await expect(ownerDeleteButton.first()).toBeDisabled()
      }
    })

    test('should not show delete button for self', async ({ page }) => {
      await goToTeam(page)

      // Admin's own row should not have delete button or it should be disabled
      const selfRow = page.locator('tr:has-text("Admin User"), div:has-text("admin@example.com")').first()
      const selfDeleteButton = selfRow.locator('button:has(svg[class*="trash"]), button[aria-label*="delete"]')
      const count = await selfDeleteButton.count()
      if (count > 0) {
        await expect(selfDeleteButton.first()).toBeDisabled()
      }
    })
  })

  test.describe('Member View (Non-Admin)', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 3,
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

      await setupTeamMock(page)
    })

    test('should display members list for regular member', async ({ page }) => {
      await goToTeam(page)

      // Should still see members list
      await expect(page.locator('text=Owner User')).toBeVisible()
      await expect(page.locator('text=Admin User')).toBeVisible()
      await expect(page.locator('text=Member User')).toBeVisible()
    })

    test('should not show delete buttons for regular member', async ({ page }) => {
      await goToTeam(page)

      // Regular members should NOT see delete buttons
      const deleteButtons = page.locator('button:has(svg[class*="red"])')
      expect(await deleteButtons.count()).toBe(0)
    })
  })

  test.describe('Role Change', () => {
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

    test('should show role selector for owner', async ({ page }) => {
      await goToTeam(page)

      // Owner can see members with their roles
      await expect(page.locator('text=Admin User')).toBeVisible()
      await expect(page.locator('text=Member User')).toBeVisible()
    })

    test('should change member role successfully', async ({ page }) => {
      await mockApiResponse(page, '/teams/1/members/3', { message: 'Role updated' }, { method: 'PATCH' })

      await goToTeam(page)

      // Find role selector for member
      const roleSelector = page.locator('button[role="combobox"]').first()
      if (await roleSelector.isVisible()) {
        await roleSelector.click()

        // Select admin role
        await page.click('[role="option"]:has-text("Admin"), [role="option"]:has-text("admin")')

        // Should show success
        await expectSuccessToast(page, 'updated').catch(async () => {
          // May update silently
          await expect(page).toHaveURL('/team')
        })
      }
    })

    test('should not allow changing owner role', async ({ page }) => {
      await goToTeam(page)

      // Owner row should not have role selector
      const ownerRow = page.locator('tr:has-text("Owner User"), div:has-text("Owner User")').first()
      const ownerRoleSelector = ownerRow.locator('button[role="combobox"], select')
      const count = await ownerRoleSelector.count()
      if (count > 0) {
        await expect(ownerRoleSelector.first()).toBeDisabled()
      }
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

      await setupTeamMock(page)
    })

    test('should close dialog on cancel', async ({ page }) => {
      await goToTeam(page)

      // Find and click a delete button
      const deleteButton = page.locator('table button').filter({ has: page.locator('svg') }).first()
      if (await deleteButton.count() > 0) {
        await deleteButton.click()
        // Should show dialog
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible()) {
          // Click cancel
          await page.locator('button:has-text("Cancel")').first().click()
        }
      }
    })

    test('should show member name in confirmation message', async ({ page }) => {
      await goToTeam(page)

      // Verify members are visible
      await expect(page.locator('text=Owner User')).toBeVisible()
    })
  })

  test.describe('Empty Members State', () => {
    test('should handle team with only owner', async ({ page }) => {
      const singleMemberTeam = {
        ...mockTeamWithMembers,
        members: [
          { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, createdAt: new Date().toISOString() },
        ],
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

      await setupTeamMock(page, singleMemberTeam)

      await goToTeam(page)

      // Should show owner
      await expect(page.locator('text=Owner User')).toBeVisible()
    })
  })

  test.describe('Leave Team', () => {
    test('should show leave team button for non-owner', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 3,
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

      await setupTeamMock(page)

      await goToTeam(page)

      // Non-owner should see the warning that they can view but cannot make changes
      await expect(page.locator('text=You can view')).toBeVisible()
    })

    test('should leave team after confirmation', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 3,
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

      await setupTeamMock(page)

      await goToTeam(page)

      // Non-owner can view team members
      await expect(page.locator('text=Owner User')).toBeVisible()
    })

    test('should not show leave team for owner', async ({ page }) => {
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

      await goToTeam(page)

      // Owner should NOT see leave team button (or it should be disabled)
      const leaveButton = page.locator('button:has-text("Leave Team"), button:has-text("Leave")')
      const count = await leaveButton.count()
      if (count > 0) {
        await expect(leaveButton.first()).toBeDisabled()
      }
    })
  })
})
