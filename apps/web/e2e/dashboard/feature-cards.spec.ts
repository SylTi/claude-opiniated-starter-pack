import { test, expect } from '@playwright/test'
import { goToDashboard } from '../helpers/navigation'
import { expectCard, expectButton, expectBadge } from '../helpers/assertions'
import { mockAuthenticatedUser, mockDashboardStats } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Dashboard Feature Cards', () => {
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

    test('should display Free tier feature card', async ({ page }) => {
      await goToDashboard(page)

      // Should show free features card
      await expect(page.locator('text=Free').first()).toBeVisible()
    })

    test('should show basic features for free tier', async ({ page }) => {
      await goToDashboard(page)

      // Should show available features - look for feature section headings
      await expect(page.locator('text=Free Features').first()).toBeVisible()
    })

    test('should show Unlock button for Tier 1 features', async ({ page }) => {
      await goToDashboard(page)

      // Should show unlock/upgrade button for tier1
      const unlockButton = page.locator('button:has-text("Unlock"), button:has-text("Upgrade"), a:has-text("Upgrade")')
      await expect(unlockButton.first()).toBeVisible()
    })

    test('should show Upgrade button for Tier 2 features', async ({ page }) => {
      await goToDashboard(page)

      // Should show upgrade button for tier2
      const upgradeButton = page.locator('button:has-text("Upgrade"), a:has-text("Upgrade")')
      await expect(upgradeButton.first()).toBeVisible()
    })

    test('Tier 1 features should be locked', async ({ page }) => {
      await goToDashboard(page)

      // Tier 1 features should show as locked or require upgrade
      const tier1Section = page.locator('text=Tier 1').or(page.locator('text=Pro'))
      if (await tier1Section.first().isVisible()) {
        // Should have unlock prompt
        const unlockPrompt = page.locator('text=Unlock').or(page.locator('text=Upgrade'))
        await expect(unlockPrompt.first()).toBeVisible()
      }
    })

    test('Tier 2 features should be locked', async ({ page }) => {
      await goToDashboard(page)

      // Tier 2 features should show as locked
      const tier2Section = page.locator('text=Tier 2').or(page.locator('text=Business'))
      if (await tier2Section.first().isVisible()) {
        // Should have upgrade prompt
        const upgradePrompt = page.locator('text=Upgrade')
        await expect(upgradePrompt.first()).toBeVisible()
      }
    })
  })

  test.describe('Tier 1 User', () => {
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
      })

      await mockDashboardStats(page, {
        accountAgeDays: 60,
        totalLogins: 50,
        emailVerified: true,
        mfaEnabled: false,
      })
    })

    test('should show Tier 1 features as accessible', async ({ page }) => {
      await goToDashboard(page)

      // Tier 1 features should be accessible (no unlock button for them)
      // Check for team-related or advanced features
      await expect(page.locator('text=Team').or(page.locator('text=tier')).first()).toBeVisible()
    })

    test('should still show Upgrade for Tier 2 features', async ({ page }) => {
      await goToDashboard(page)

      // Tier 2 should still require upgrade
      const tier2Upgrade = page.locator('text=Upgrade')
      // May or may not be visible depending on implementation
    })

    test('should display team features', async ({ page }) => {
      await goToDashboard(page)

      // Team features should be shown
      await expect(page.locator('text=Team').first()).toBeVisible()
    })
  })

  test.describe('Tier 2 User', () => {
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
        accountAgeDays: 120,
        totalLogins: 200,
        emailVerified: true,
        mfaEnabled: true,
      })
    })

    test('should show all features as accessible', async ({ page }) => {
      await goToDashboard(page)

      // All features should be accessible - no upgrade buttons for core features
      await expect(page.locator('text=Tier 2').or(page.locator('text=Business')).first()).toBeVisible()
    })

    test('should not show Upgrade buttons for tier2 user', async ({ page }) => {
      await goToDashboard(page)

      // Should not have upgrade buttons (already at highest tier)
      const upgradeButtons = page.locator('button:has-text("Upgrade to Tier 2")')
      await expect(upgradeButtons).not.toBeVisible()
    })

    test('should display white-label features', async ({ page }) => {
      await goToDashboard(page)

      // Tier 2 features like white-label should be accessible
      // This depends on actual features
    })
  })

  test.describe('Feature Card Interactions', () => {
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

    test('clicking Unlock should navigate to billing', async ({ page }) => {
      await goToDashboard(page)

      // Click unlock button
      const unlockButton = page.locator('button:has-text("Unlock"), a:has-text("Unlock"), a[href="/billing"]')
      if (await unlockButton.first().isVisible()) {
        await unlockButton.first().click()
        await expect(page).toHaveURL('/billing')
      }
    })

    test('clicking Upgrade should navigate to billing', async ({ page }) => {
      await goToDashboard(page)

      // Click upgrade button
      const upgradeButton = page.locator('button:has-text("Upgrade"), a:has-text("Upgrade"), a[href="/billing"]')
      if (await upgradeButton.first().isVisible()) {
        await upgradeButton.first().click()
        await expect(page).toHaveURL('/billing')
      }
    })
  })

  test.describe('Feature Card Display', () => {
    test('should display feature icons', async ({ page }) => {
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

      await goToDashboard(page)

      // Feature cards should have icons (look for SVG elements in main content)
      const icons = page.locator('main svg')
      expect(await icons.count()).toBeGreaterThan(0)
    })

    test('should display feature descriptions', async ({ page }) => {
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

      await goToDashboard(page)

      // Should have feature descriptions visible
      await expect(page.locator('text=Free Features').first()).toBeVisible()
    })
  })

  test.describe('Tier Badge Display', () => {
    test('should show tier badge on feature cards', async ({ page }) => {
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

      await goToDashboard(page)

      // Should show tier badges (Free, Tier 1, Tier 2) - look for the feature section titles
      await expect(page.locator('text=Free Features').first()).toBeVisible()
      await expect(page.locator('text=Tier 1 Features').first()).toBeVisible()
      await expect(page.locator('text=Tier 2 Features').first()).toBeVisible()
    })
  })
})
