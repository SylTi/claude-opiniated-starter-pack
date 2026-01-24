import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // Add tenant_id to login_history (nullable for historical records)
    await this.db.rawQuery(`
      ALTER TABLE login_history
      ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
    `)
    await this.db.rawQuery(`CREATE INDEX idx_login_history_tenant_id ON login_history (tenant_id);`)

    // Add tenant_id to discount_code_usages (billing context)
    await this.db.rawQuery(`
      ALTER TABLE discount_code_usages
      ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    `)
    await this.db.rawQuery(
      `CREATE INDEX idx_discount_code_usages_tenant_id ON discount_code_usages (tenant_id);`
    )

    // Update index to include tenant_id for discount_code_usages
    await this.db.rawQuery(
      `DROP INDEX IF EXISTS discount_code_usages_discount_code_id_user_id_index;`
    )
    await this.db.rawQuery(`
      CREATE INDEX discount_code_usages_tenant_code_idx
      ON discount_code_usages (tenant_id, discount_code_id);
    `)
  }

  async down(): Promise<void> {
    // Restore original index
    await this.db.rawQuery(`DROP INDEX IF EXISTS discount_code_usages_tenant_code_idx;`)
    await this.db.rawQuery(`
      CREATE INDEX discount_code_usages_discount_code_id_user_id_index
      ON discount_code_usages (discount_code_id, user_id);
    `)

    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_discount_code_usages_tenant_id;`)
    await this.db.rawQuery(`ALTER TABLE discount_code_usages DROP COLUMN IF EXISTS tenant_id;`)

    await this.db.rawQuery(`DROP INDEX IF EXISTS idx_login_history_tenant_id;`)
    await this.db.rawQuery(`ALTER TABLE login_history DROP COLUMN IF EXISTS tenant_id;`)
  }
}
