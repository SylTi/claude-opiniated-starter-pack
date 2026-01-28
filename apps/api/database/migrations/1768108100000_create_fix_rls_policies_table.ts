import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix RLS Policies
 *
 * This migration addresses several RLS issues:
 *
 * 1. Middleware membership check (CRITICAL):
 *    - TenantContextMiddleware queries tenant_memberships BEFORE RLS context is set
 *    - Solution: Create SECURITY DEFINER function for membership lookup
 *
 * 2. Public SSO/invitation flows (CRITICAL):
 *    - SSO and invitation endpoints need to query tenants/invitations without tenant context
 *    - Solution: Create SECURITY DEFINER functions for public lookups
 *
 * 3. System/webhook operations (MAJOR):
 *    - Webhooks use user_id=0 but RLS policies don't allow system bypass
 *    - Solution: Add system bypass clause (user_id = 0) to all policies
 *
 * 4. Subscription downgrade outside HttpContext (MAJOR):
 *    - Fixed by system bypass in policies
 *
 * 5. Scheduled commands outside HttpContext (MAJOR):
 *    - Fixed by system bypass in policies
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. SECURITY DEFINER functions for public/system operations
    // ============================================

    // Function for middleware to check membership (bypasses RLS)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_check_user_membership(p_tenant_id integer, p_user_id integer)
      RETURNS TABLE(id integer, tenant_id integer, user_id integer, role text)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT m.id, m.tenant_id, m.user_id, m.role::text
        FROM tenant_memberships m
        WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
        LIMIT 1
      $$;
    `)

    // Function for public tenant lookup (SSO check endpoint)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_get_tenant_public(p_tenant_id integer)
      RETURNS TABLE(id integer, name text, slug text)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT t.id, t.name, t.slug
        FROM tenants t
        WHERE t.id = p_tenant_id
        LIMIT 1
      $$;
    `)

    // Function for public invitation lookup by token
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_get_invitation_by_token(p_token text)
      RETURNS TABLE(
        id integer,
        tenant_id integer,
        email text,
        role text,
        status text,
        expires_at timestamptz,
        invited_by_id integer,
        tenant_name text,
        tenant_slug text,
        inviter_full_name text,
        inviter_email text
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT
          i.id,
          i.tenant_id,
          i.email,
          i.role::text,
          i.status::text,
          i.expires_at,
          i.invited_by_id,
          t.name as tenant_name,
          t.slug as tenant_slug,
          u.full_name as inviter_full_name,
          u.email as inviter_email
        FROM tenant_invitations i
        JOIN tenants t ON t.id = i.tenant_id
        LEFT JOIN users u ON u.id = i.invited_by_id
        WHERE i.token = p_token
        LIMIT 1
      $$;
    `)

    // Function to update invitation status by token (for accepting/declining)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_update_invitation_status(p_token text, p_status text)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        UPDATE tenant_invitations
        SET status = p_status, updated_at = NOW()
        WHERE token = p_token
          AND status = 'pending';
        RETURN FOUND;
      END;
      $$;
    `)

    // ============================================
    // 2. Update RLS policies with system bypass (user_id = 0)
    // ============================================

    // Drop existing policies and recreate with system bypass

    // --- tenants table ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS tenants_member_access ON tenants;`)
    await this.db.rawQuery(`
      CREATE POLICY tenants_member_access ON tenants
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR app_is_tenant_member(id, app_current_user_id())
        );
    `)

    // --- tenant_memberships table ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS memberships_tenant_access ON tenant_memberships;`)
    await this.db.rawQuery(`
      CREATE POLICY memberships_tenant_access ON tenant_memberships
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id = app_current_tenant_id()
          OR user_id = app_current_user_id()  -- Users can see their own memberships
        );
    `)

    // --- tenant_invitations table ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS invitations_tenant_access ON tenant_invitations;`)
    await this.db.rawQuery(`
      CREATE POLICY invitations_tenant_access ON tenant_invitations
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // --- login_history table ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS login_history_tenant_access ON login_history;`)
    await this.db.rawQuery(`
      CREATE POLICY login_history_tenant_access ON login_history
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // --- subscriptions table ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS subscriptions_tenant_access ON subscriptions;`)
    await this.db.rawQuery(`
      CREATE POLICY subscriptions_tenant_access ON subscriptions
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass for webhooks
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // --- payment_customers table ---
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS payment_customers_tenant_access ON payment_customers;`
    )
    await this.db.rawQuery(`
      CREATE POLICY payment_customers_tenant_access ON payment_customers
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass for webhooks
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // --- discount_code_usages table ---
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS discount_usages_tenant_access ON discount_code_usages;`
    )
    await this.db.rawQuery(`
      CREATE POLICY discount_usages_tenant_access ON discount_code_usages
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `)
  }

  async down(): Promise<void> {
    // Restore original policies (without system bypass)

    // --- discount_code_usages ---
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS discount_usages_tenant_access ON discount_code_usages;`
    )
    await this.db.rawQuery(`
      CREATE POLICY discount_usages_tenant_access ON discount_code_usages
        FOR ALL
        USING (tenant_id IS NULL OR tenant_id = app_current_tenant_id());
    `)

    // --- payment_customers ---
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS payment_customers_tenant_access ON payment_customers;`
    )
    await this.db.rawQuery(`
      CREATE POLICY payment_customers_tenant_access ON payment_customers
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // --- subscriptions ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS subscriptions_tenant_access ON subscriptions;`)
    await this.db.rawQuery(`
      CREATE POLICY subscriptions_tenant_access ON subscriptions
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // --- login_history ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS login_history_tenant_access ON login_history;`)
    await this.db.rawQuery(`
      CREATE POLICY login_history_tenant_access ON login_history
        FOR ALL
        USING (tenant_id IS NULL OR tenant_id = app_current_tenant_id());
    `)

    // --- tenant_invitations ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS invitations_tenant_access ON tenant_invitations;`)
    await this.db.rawQuery(`
      CREATE POLICY invitations_tenant_access ON tenant_invitations
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // --- tenant_memberships ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS memberships_tenant_access ON tenant_memberships;`)
    await this.db.rawQuery(`
      CREATE POLICY memberships_tenant_access ON tenant_memberships
        FOR ALL
        USING (tenant_id = app_current_tenant_id());
    `)

    // --- tenants ---
    await this.db.rawQuery(`DROP POLICY IF EXISTS tenants_member_access ON tenants;`)
    await this.db.rawQuery(`
      CREATE POLICY tenants_member_access ON tenants
        FOR ALL
        USING (app_is_tenant_member(id, app_current_user_id()));
    `)

    // Drop helper functions
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_update_invitation_status(text, text);`)
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_get_invitation_by_token(text);`)
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_get_tenant_public(integer);`)
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_check_user_membership(integer, integer);`)
  }
}
