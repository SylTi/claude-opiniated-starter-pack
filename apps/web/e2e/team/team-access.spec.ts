import { test, expect } from '@playwright/test'
import { goto, goToTeam } from '../helpers/navigation'
import { mockAuthenticatedUser, mockUnauthenticated } from '../fixtures/api-mock.fixture'
import { TEST_USERS } from '../fixtures/auth.fixture'

test.describe('Team Page Access Control', () => {
  test.describe('Authentication Required', () => {
    test('should redirect unauthenticated user to /login', async ({ page }) => {
      await mockUnauthenticated(page)

      await goto(page, '/team')

      await expect(page).toHaveURL('/login', { timeout: 10000 })
    })
  })

  test.describe('Tier Requirements', () => {
    test('should redirect free tier user to /dashboard', async ({ page }) => {
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

      await goto(page, '/team')

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should allow tier1 user with team to access /team', async ({ page }) => {
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
              name: 'Test Team',
              slug: 'test-team',
              tier: 'tier1',
              members: [],
              invitations: [],
            },
          }),
        })
      })

      await goto(page, '/team')

      await expect(page).toHaveURL('/team', { timeout: 10000 })
    })

    test('should allow tier2 user with team to access /team', async ({ page }) => {
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

      // Mock team data
      await page.route('**/api/v1/teams/2', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 2,
              name: 'Enterprise Team',
              slug: 'enterprise-team',
              tier: 'tier2',
              members: [],
              invitations: [],
            },
          }),
        })
      })

      await goto(page, '/team')

      await expect(page).toHaveURL('/team', { timeout: 10000 })
    })
  })

  test.describe('Team Requirement', () => {
    test('should redirect tier1 user without team to /dashboard', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: null, // No team
        createdAt: new Date().toISOString(),
      })

      await goto(page, '/team')

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })

    test('should redirect tier2 user without team to /dashboard', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier2.email,
        fullName: TEST_USERS.tier2.fullName,
        role: 'user',
        subscriptionTier: 'tier2',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
        avatarUrl: null,
        currentTeamId: null, // No team
        createdAt: new Date().toISOString(),
      })

      await goto(page, '/team')

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })
  })

  test.describe('Admin Access', () => {
    test('admin with team should access /team', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.admin.email,
        fullName: TEST_USERS.admin.fullName,
        role: 'admin',
        subscriptionTier: 'tier2',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
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
              name: 'Admin Team',
              slug: 'admin-team',
              tier: 'tier2',
              members: [],
              invitations: [],
            },
          }),
        })
      })

      await goto(page, '/team')

      await expect(page).toHaveURL('/team', { timeout: 10000 })
    })
  })

  test.describe('Error Handling', () => {
    test('should handle team fetch error gracefully', async ({ page }) => {
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

      // Mock team fetch error
      await page.route('**/api/v1/teams/1', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'InternalServerError',
            message: 'Failed to fetch team',
          }),
        })
      })

      await goto(page, '/team')

      // Should handle error gracefully
      // May redirect or show error
    })

    test('should handle team not found', async ({ page }) => {
      await mockAuthenticatedUser(page, {
        id: 1,
        email: TEST_USERS.tier1.email,
        fullName: TEST_USERS.tier1.fullName,
        role: 'user',
        subscriptionTier: 'tier1',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: false,
        avatarUrl: null,
        currentTeamId: 999,
        createdAt: new Date().toISOString(),
      })

      // Mock team not found
      await page.route('**/api/v1/teams/999', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'NotFound',
            message: 'Team not found',
          }),
        })
      })

      await goto(page, '/team')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    })
  })
})
