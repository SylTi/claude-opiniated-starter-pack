import { test } from '@japa/runner'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'

test.group('SubscriptionTier Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
    // Note: Tests rely on seeded tiers (free, tier1, tier2) from database
  })

  test('findBySlug returns correct tier', async ({ assert }) => {
    const freeTier = await SubscriptionTier.findBySlug('free')
    assert.isNotNull(freeTier)
    assert.equal(freeTier!.slug, 'free')
    assert.equal(freeTier!.name, 'Free')
    assert.equal(freeTier!.level, 0)
  })

  test('findBySlugOrFail throws for non-existent tier', async ({ assert }) => {
    await assert.rejects(async () => {
      await SubscriptionTier.findBySlugOrFail('non-existent')
    })
  })

  test('getFreeTier returns free tier', async ({ assert }) => {
    const freeTier = await SubscriptionTier.getFreeTier()
    assert.equal(freeTier.slug, 'free')
    assert.equal(freeTier.level, 0)
  })

  test('getActiveTiers returns active tiers ordered by level', async ({ assert }) => {
    const tiers = await SubscriptionTier.getActiveTiers()

    // Should have at least the base tiers
    assert.isAtLeast(tiers.length, 3)

    // Should be ordered by level
    for (let i = 1; i < tiers.length; i++) {
      assert.isAtLeast(tiers[i].level, tiers[i - 1].level, 'Tiers should be ordered by level')
    }

    // Should include the expected base tiers
    const slugs = tiers.map((t) => t.slug)
    assert.include(slugs, 'free')
    assert.include(slugs, 'tier1')
    assert.include(slugs, 'tier2')

    // Free tier should be first (level 0)
    assert.equal(tiers[0].slug, 'free')
  })

  test('hasAccessToTier checks level correctly', async ({ assert }) => {
    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    // Free tier only has access to free
    assert.isTrue(freeTier.hasAccessToTier(freeTier))
    assert.isFalse(freeTier.hasAccessToTier(tier1))
    assert.isFalse(freeTier.hasAccessToTier(tier2))

    // Tier1 has access to free and tier1
    assert.isTrue(tier1.hasAccessToTier(freeTier))
    assert.isTrue(tier1.hasAccessToTier(tier1))
    assert.isFalse(tier1.hasAccessToTier(tier2))

    // Tier2 has access to all
    assert.isTrue(tier2.hasAccessToTier(freeTier))
    assert.isTrue(tier2.hasAccessToTier(tier1))
    assert.isTrue(tier2.hasAccessToTier(tier2))
  })

  test('hasAccessToLevel checks level correctly', async ({ assert }) => {
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')

    assert.isTrue(tier1.hasAccessToLevel(0))
    assert.isTrue(tier1.hasAccessToLevel(1))
    assert.isFalse(tier1.hasAccessToLevel(2))
  })

  test('maxTeamMembers is set correctly for each tier', async ({ assert }) => {
    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    assert.equal(freeTier.maxTeamMembers, 5)
    assert.equal(tier1.maxTeamMembers, 20)
    assert.isNull(tier2.maxTeamMembers)
  })
})
