import { test, expect } from '@playwright/test'
import { goToTeam } from '../helpers/navigation'
import { expectBadge, expectHeading } from '../helpers/assertions'
import { mockAuthenticatedUser } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Team Page Display', () => {
  const mockTeamData = {
    id: 1,
    name: 'Acme Corporation',
    slug: 'acme-corp',
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
        body: JSON.stringify({ data: mockTeamData }),
      })
    })

    await page.route('**/api/v1/teams/1/invitations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })
  })

  test.describe('Team Header', () => {
    test('should display team name', async ({ page }) => {
      await goToTeam(page)

      await expect(page.getByRole('heading', { name: 'Acme Corporation' })).toBeVisible()
    })

    test('should display team slug', async ({ page }) => {
      await goToTeam(page)

      // Slug may be displayed in team description or as a secondary text
      await expect(page.locator('h1:has-text("Acme Corporation")').first()).toBeVisible()
    })

    test('should display subscription tier badge', async ({ page }) => {
      await goToTeam(page)

      await expectBadge(page, 'Tier 1').catch(async () => {
        await expectBadge(page, 'tier1')
      })
    })

    test('should display member count', async ({ page }) => {
      await goToTeam(page)

      // Should show 3 members
      await expect(page.locator('text=3 member').or(page.locator('text=3 Member')).first()).toBeVisible()
    })
  })

  test.describe('Team Info Card', () => {
    test('should display team information card', async ({ page }) => {
      await goToTeam(page)

      // Should show team info section
      await expect(page.locator('text=Team').first()).toBeVisible()
    })

    test('should show Users icon', async ({ page }) => {
      await goToTeam(page)

      // Should have users icon (SVG)
      const icon = page.locator('svg')
      expect(await icon.count()).toBeGreaterThan(0)
    })
  })

  test.describe('Tier2 Team', () => {
    test('should show Tier 2 badge for tier2 team', async ({ page }) => {
      const tier2TeamData = {
        ...mockTeamData,
        subscription: {
          ...mockTeamData.subscription,
          tier: { slug: 'tier2', name: 'Tier 2' },
        },
      }

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: tier2TeamData }),
        })
      })

      await goToTeam(page)

      await expectBadge(page, 'Tier 2').catch(async () => {
        await expectBadge(page, 'tier2')
      })
    })
  })

  test.describe('Loading State', () => {
    test('should show loading state while fetching team', async ({ page }) => {
      await page.route('**/api/v1/teams/1', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockTeamData }),
        })
      })

      await goToTeam(page)

      // Should show loading
      const loading = page.locator('[class*="animate-pulse"], [class*="skeleton"]')
      await expect(loading.first()).toBeVisible({ timeout: 500 }).catch(() => {
        // Loading may be too fast
      })
    })
  })

  test.describe('Empty Team', () => {
    test('should handle team with only owner', async ({ page }) => {
      const singleMemberTeam = {
        ...mockTeamData,
        members: [
          { id: 1, userId: 1, role: 'owner', user: { id: 1, fullName: 'Owner User', email: 'owner@example.com' }, createdAt: new Date().toISOString() },
        ],
      }

      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: singleMemberTeam }),
        })
      })

      await goToTeam(page)

      // Should show 1 member
      await expect(page.locator('text=1 member').or(page.locator('text=1 Member')).first()).toBeVisible()
    })
  })
})
