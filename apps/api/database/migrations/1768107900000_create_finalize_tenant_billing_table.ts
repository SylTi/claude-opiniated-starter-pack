import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // This migration finalizes the tenant-only billing model by:
    // 1. Making tenant_id NOT NULL in subscriptions and payment_customers
    // 2. Removing the old polymorphic columns (subscriber_type, subscriber_id)

    // First, ensure all subscriptions have a tenant_id
    // For any remaining user subscriptions, we need to create personal tenants
    // This should have been done by the data migration, but let's handle edge cases

    // Check if there are any subscriptions without tenant_id
    const orphanedSubs = await this.db.rawQuery(`
      SELECT COUNT(*) as count FROM subscriptions WHERE tenant_id IS NULL
    `)

    if (orphanedSubs.rows[0].count > 0) {
      console.warn(
        `Warning: ${orphanedSubs.rows[0].count} subscriptions without tenant_id. They will be deleted.`
      )
      // Delete orphaned subscriptions (they should have been migrated)
      await this.db.rawQuery(`DELETE FROM subscriptions WHERE tenant_id IS NULL`)
    }

    // Check payment_customers
    const orphanedCustomers = await this.db.rawQuery(`
      SELECT COUNT(*) as count FROM payment_customers WHERE tenant_id IS NULL
    `)

    if (orphanedCustomers.rows[0].count > 0) {
      console.warn(
        `Warning: ${orphanedCustomers.rows[0].count} payment_customers without tenant_id. They will be deleted.`
      )
      await this.db.rawQuery(`DELETE FROM payment_customers WHERE tenant_id IS NULL`)
    }

    // 1. Make tenant_id NOT NULL in subscriptions
    await this.db.rawQuery(`
      ALTER TABLE subscriptions
      ALTER COLUMN tenant_id SET NOT NULL;
    `)

    // 2. Drop the old polymorphic columns from subscriptions
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_subscriber;`)
    await this.db.rawQuery(`
      ALTER TABLE subscriptions
      DROP COLUMN IF EXISTS subscriber_type,
      DROP COLUMN IF EXISTS subscriber_id;
    `)

    // 3. Make tenant_id NOT NULL in payment_customers
    await this.db.rawQuery(`
      ALTER TABLE payment_customers
      ALTER COLUMN tenant_id SET NOT NULL;
    `)

    // 4. Drop the old polymorphic columns from payment_customers
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_payment_customer_subscriber;`)
    await this.db.rawQuery(`
      ALTER TABLE payment_customers
      DROP COLUMN IF EXISTS subscriber_type,
      DROP COLUMN IF EXISTS subscriber_id;
    `)

    // 5. Add unique constraint on tenant_id + provider for payment_customers
    await this.db.rawQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_customers_tenant_provider
      ON payment_customers (tenant_id, provider);
    `)
  }

  async down(): Promise<void> {
    // Re-add the polymorphic columns (will need manual data restoration)
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_payment_customers_tenant_provider;`)

    // Add back subscriber columns to payment_customers
    await this.db.rawQuery(`
      ALTER TABLE payment_customers
      ADD COLUMN subscriber_type VARCHAR(20),
      ADD COLUMN subscriber_id INTEGER;
    `)

    // Add back subscriber columns to subscriptions
    await this.db.rawQuery(`
      ALTER TABLE subscriptions
      ADD COLUMN subscriber_type VARCHAR(20),
      ADD COLUMN subscriber_id INTEGER;
    `)

    // Make tenant_id nullable again
    await this.db.rawQuery(`
      ALTER TABLE subscriptions
      ALTER COLUMN tenant_id DROP NOT NULL;
    `)
    await this.db.rawQuery(`
      ALTER TABLE payment_customers
      ALTER COLUMN tenant_id DROP NOT NULL;
    `)

    // Recreate old indexes
    await this.db.rawQuery(
      `CREATE INDEX idx_subscriber ON subscriptions (subscriber_type, subscriber_id);`
    )
    await this.db.rawQuery(
      `CREATE INDEX idx_payment_customer_subscriber ON payment_customers (subscriber_type, subscriber_id);`
    )
  }
}
