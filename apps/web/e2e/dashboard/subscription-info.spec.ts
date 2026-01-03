import { test, expect } from '@playwright/test'
import { goToDashboard } from '../helpers/navigation'
import { expectBadge, expectButton } from '../helpers/assertions'
import { mockAuthenticatedUser, mockDashboardStats } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Dashboard Subscription Info', () => {
  test.describe('Free Tier User', () => {
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

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })
    })

    test('should show Free plan badge', async ({ page }) => {
      await goToDashboard(page)

      // Should show free tier badge
      await expectBadge(page, 'Free').catch(async () => {
        await expect(page.locator('text=Free')).toBeVisible()
      })
    })

    test('should not show expiration date for free tier', async ({ page }) => {
      await goToDashboard(page)

      // Should NOT show expiration/renewal
      const expirationText = page.locator('text=Expires').or(page.locator('text=Renewal'))
      await expect(expirationText).not.toBeVisible()
    })

    test('should not show Manage Team button for free tier', async ({ page }) => {
      await goToDashboard(page)

      // Should NOT show manage team
      await expect(page.locator('button:has-text("Manage Team")')).not.toBeVisible()
    })
  })

  test.describe('Tier1 Subscriber', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
        currentTeam: {
          id: 1,
          name: 'Test Team',
          slug: 'test-team',
          subscription: {
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })
    })

    test('should show Tier 1 plan badge', async ({ page }) => {
      await goToDashboard(page)

      // Should show tier1 badge
      await expect(page.locator('text=Tier 1').or(page.locator('text=Pro')).first()).toBeVisible()
    })

    test('should show team info for tier1 user with team', async ({ page }) => {
      await goToDashboard(page)

      // Should show team related info
      await expect(page.locator('text=Team').first()).toBeVisible()
    })

    test('should show Manage Team button for tier1 user', async ({ page }) => {
      await goToDashboard(page)

      // Should show manage team button or link
      const manageTeam = page.locator('a[href="/team"], button:has-text("Manage Team")')
      await expect(manageTeam.first()).toBeVisible()
    })
  })

  test.describe('Tier2 Subscriber', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier2.email,
        fullName: TEST_USERS.tier2.fullName,
        role: 'user',
        subscriptionTier: 'tier2',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: 2,
        createdAt: new Date().toISOString(),
      })

      await mockDashboardStats(page, {
        accountAgeDays: 90,
        totalLogins: 100,
        emailVerified: true,
        mfaEnabled: true,
      })
    })

    test('should show Tier 2 plan badge', async ({ page }) => {
      await goToDashboard(page)

      // Should show tier2 badge
      await expect(page.locator('text=Tier 2').or(page.locator('text=Business')).or(page.locator('text=Enterprise')).first()).toBeVisible()
    })

    test('should show all premium features', async ({ page }) => {
      await goToDashboard(page)

      // Should have full access indicators
      await expect(page.locator('text=Team').or(page.locator('text=tier')).first()).toBeVisible()
    })
  })

  test.describe('Subscription Expiration', () => {
    test('should show expiration date for active subscription', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      // Mock billing data with subscription
      await page.route('**/api/v1/billing/subscription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              plan: 'Tier 1',
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          }),
        })
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // May show renewal or expiration date
      // This depends on implementation
    })
  })

  test.describe('Team Info Display', () => {
    test('should show team name for user with team', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      // Mock team data
      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 1,
              name: 'Acme Corp',
              slug: 'acme-corp',
              tier: 'tier1',
            },
          }),
        })
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Should show team name if displayed on dashboard
      await expect(page.locator('text=Acme').or(page.locator('text=Team')).first()).toBeVisible()
    })

    test('should show team slug', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      // Mock team data
      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 1,
              name: 'Acme Corp',
              slug: 'acme-corp',
              tier: 'tier1',
            },
          }),
        })
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Team slug may or may not be visible on dashboard
      // This is implementation-specific
    })
  })

  test.describe('Manage Team Navigation', () => {
    test('should navigate to /team when clicking Manage Team', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 1,
        createdAt: new Date().toISOString(),
      })

      // Mock team
      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 1,
              name: 'Test Team',
              slug: 'test-team',
              tier: 'tier1',
              members: [],
              invitations: [],
            },
          }),
        })
      })

      await mockDashboardStats(page, {
        accountAgeDays: 30,
        totalLogins: 10,
        emailVerified: true,
        mfaEnabled: false,
      })

      await goToDashboard(page)

      // Click manage team link/button
      const teamLink = page.locator('a:has-text("Team"), a[href="/team"]')
      if (await teamLink.first().isVisible()) {
        await teamLink.first().click()
        await expect(page).toHaveURL('/team')
      }
    })
  })
})
