import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.defer(async (db) => {
      // Get tier IDs
      const tiers = await db.from('subscription_tiers').select('id', 'slug')
      const tierMap: Record<string, number> = {}
      for (const tier of tiers) {
        tierMap[tier.slug] = tier.id
      }

      const freeTierId = tierMap['free']
      const now = new Date()

      // Migrate users
      const users = await db.from('users').select('*')
      for (const user of users) {
        const tierSlug = user.subscription_tier || 'free'
        const tierId = tierMap[tierSlug] || freeTierId
        const expiresAt = user.subscription_expires_at

        // Determine status
        let status = 'active'
        if (expiresAt && new Date(expiresAt) < now && tierSlug !== 'free') {
          status = 'expired'
        }

        await db.table('subscriptions').insert({
          subscriber_type: 'user',
          subscriber_id: user.id,
          tier_id: tierId,
          status,
          starts_at: user.created_at || now,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        })
      }

      // Migrate teams
      const teams = await db.from('teams').select('*')
      for (const team of teams) {
        const tierSlug = team.subscription_tier || 'free'
        const tierId = tierMap[tierSlug] || freeTierId
        const expiresAt = team.subscription_expires_at

        // Determine status
        let status = 'active'
        if (expiresAt && new Date(expiresAt) < now && tierSlug !== 'free') {
          status = 'expired'
        }

        await db.table('subscriptions').insert({
          subscriber_type: 'team',
          subscriber_id: team.id,
          tier_id: tierId,
          status,
          starts_at: team.created_at || now,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        })
      }
    })
  }

  async down(): Promise<void> {
    // Delete all migrated subscriptions
    this.defer(async (db) => {
      await db.from('subscriptions').delete()
    })
  }
}
