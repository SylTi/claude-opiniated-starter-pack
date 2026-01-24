import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // Create helper function to get current tenant ID from session
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_tenant_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      AS $$
        SELECT nullif(current_setting('app.tenant_id', true), '')::integer
      $$;
    `)

    // Create helper function to get current user ID from session
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_user_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      AS $$
        SELECT nullif(current_setting('app.user_id', true), '')::integer
      $$;
    `)
  }

  async down(): Promise<void> {
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_current_tenant_id();`)
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_current_user_id();`)
  }
}
