import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // 1. Rename max_uses_per_user to max_uses_per_tenant in discount_codes
    await this.db.rawQuery(`
      ALTER TABLE discount_codes
      RENAME COLUMN max_uses_per_user TO max_uses_per_tenant;
    `)

    // 2. Add redeemed_for_tenant_id to coupons (which tenant got the credit)
    // Keep redeemed_by_user_id for audit trail (WHO redeemed it)
    await this.db.rawQuery(`
      ALTER TABLE coupons
      ADD COLUMN redeemed_for_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
    `)

    // 3. Create index on redeemed_for_tenant_id
    await this.db.rawQuery(
      `CREATE INDEX idx_coupons_redeemed_for_tenant ON coupons (redeemed_for_tenant_id);`
    )
  }

  async down(): Promise<void> {
    // Drop index
    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_coupons_redeemed_for_tenant;`)

    // Remove redeemed_for_tenant_id from coupons
    await this.db.rawQuery(`ALTER TABLE coupons DROP COLUMN IF EXISTS redeemed_for_tenant_id;`)

    // Rename column back
    await this.db.rawQuery(`
      ALTER TABLE discount_codes
      RENAME COLUMN max_uses_per_tenant TO max_uses_per_user;
    `)
  }
}
