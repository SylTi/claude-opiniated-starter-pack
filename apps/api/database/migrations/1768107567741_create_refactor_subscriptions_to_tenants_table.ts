import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // 1. Add tenant_id to subscriptions (nullable initially for migration)
    await this.db.rawQuery(`
      ALTER TABLE subscriptions
      ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    `)

    // 2. Add tenant_id to payment_customers (nullable initially for migration)
    await this.db.rawQuery(`
      ALTER TABLE payment_customers
      ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    `)

    // 3. Migrate existing team subscriptions (subscriber_type = 'team')
    // The subscriber_id IS the tenant_id for teams
    await this.db.rawQuery(`
      UPDATE subscriptions
      SET tenant_id = subscriber_id
      WHERE subscriber_type = 'team';
    `)

    // 4. Migrate existing team payment_customers
    await this.db.rawQuery(`
      UPDATE payment_customers
      SET tenant_id = subscriber_id
      WHERE subscriber_type = 'team';
    `)

    // Note: User subscriptions (subscriber_type = 'user') will be migrated
    // after personal tenants are created in a separate data migration step

    // 5. Create index on tenant_id
    await this.db.rawQuery(`CREATE INDEX idx_subscriptions_tenant_id ON subscriptions (tenant_id);`)
    await this.db.rawQuery(
      `CREATE INDEX idx_payment_customers_tenant_id ON payment_customers (tenant_id);`
    )
  }

  async down(): Promise<void> {
    // Drop indexes
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_subscriptions_tenant_id;`)
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_payment_customers_tenant_id;`)

    // Remove tenant_id columns
    await this.db.rawQuery(`ALTER TABLE payment_customers DROP COLUMN IF EXISTS tenant_id;`)
    await this.db.rawQuery(`ALTER TABLE subscriptions DROP COLUMN IF EXISTS tenant_id;`)
  }
}
