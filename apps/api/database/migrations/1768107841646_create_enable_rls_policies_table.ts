import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // 1. Create membership check function (SECURITY DEFINER to bypass RLS for the check itself)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_is_tenant_member(check_tenant_id integer, check_user_id integer)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM tenant_memberships m
          WHERE m.tenant_id = check_tenant_id
            AND m.user_id = check_user_id
        )
      $$;
    `)

    // 2. Enable RLS on tenants table
    await this.db.rawQuery(`ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE tenants FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY tenants_member_access ON tenants
        FOR ALL
        USING (app_is_tenant_member(id, app_current_user_id()));
    `)

    // 3. Enable RLS on tenant_memberships table
    await this.db.rawQuery(`ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY memberships_tenant_access ON tenant_memberships
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // 4. Enable RLS on tenant_invitations table
    await this.db.rawQuery(`ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE tenant_invitations FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY invitations_tenant_access ON tenant_invitations
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // 5. Enable RLS on login_history table
    await this.db.rawQuery(`ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE login_history FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY login_history_tenant_access ON login_history
        FOR ALL
        USING (
          tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // 6. Enable RLS on subscriptions table
    await this.db.rawQuery(`ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY subscriptions_tenant_access ON subscriptions
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // 7. Enable RLS on payment_customers table
    await this.db.rawQuery(`ALTER TABLE payment_customers ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE payment_customers FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY payment_customers_tenant_access ON payment_customers
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // 8. Enable RLS on discount_code_usages table
    await this.db.rawQuery(`ALTER TABLE discount_code_usages ENABLE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`ALTER TABLE discount_code_usages FORCE ROW LEVEL SECURITY;`)
    await this.db.rawQuery(`
      CREATE POLICY discount_usages_tenant_access ON discount_code_usages
        FOR ALL
        USING (
          tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `)
  }

  async down(): Promise<void> {
    // Drop policies and disable RLS in reverse order
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS discount_usages_tenant_access ON discount_code_usages;`
    )
    await this.db.rawQuery(`ALTER TABLE discount_code_usages DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(
      `DROP POLICY IF EXISTS payment_customers_tenant_access ON payment_customers;`
    )
    await this.db.rawQuery(`ALTER TABLE payment_customers DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP POLICY IF EXISTS subscriptions_tenant_access ON subscriptions;`)
    await this.db.rawQuery(`ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP POLICY IF EXISTS login_history_tenant_access ON login_history;`)
    await this.db.rawQuery(`ALTER TABLE login_history DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP POLICY IF EXISTS invitations_tenant_access ON tenant_invitations;`)
    await this.db.rawQuery(`ALTER TABLE tenant_invitations DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP POLICY IF EXISTS memberships_tenant_access ON tenant_memberships;`)
    await this.db.rawQuery(`ALTER TABLE tenant_memberships DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP POLICY IF EXISTS tenants_member_access ON tenants;`)
    await this.db.rawQuery(`ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;`)

    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_is_tenant_member(integer, integer);`)
  }
}
