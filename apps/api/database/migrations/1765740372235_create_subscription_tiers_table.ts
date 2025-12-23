import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_tiers'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('slug', 20).notNullable().unique()
      table.string('name', 50).notNullable()
      table.integer('level').notNullable().defaultTo(0)
      table.integer('max_team_members').nullable()
      table.decimal('price_monthly', 10, 2).nullable()
      table.integer('yearly_discount_percent').nullable().defaultTo(0)
      table.jsonb('features').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Seed initial tiers
    this.defer(async (db) => {
      await db.table(this.tableName).multiInsert([
        {
          slug: 'free',
          name: 'Free',
          level: 0,
          max_team_members: 5,
          price_monthly: null,
          features: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          slug: 'tier1',
          name: 'Tier 1',
          level: 1,
          max_team_members: 20,
          price_monthly: null,
          features: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          slug: 'tier2',
          name: 'Tier 2',
          level: 2,
          max_team_members: null,
          price_monthly: null,
          features: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}
