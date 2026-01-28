import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix Login History RLS and Function Grants
 *
 * This migration addresses two issues:
 *
 * 1. Login History RLS (CRITICAL):
 *    - Previous policy: tenant_id = app_current_tenant_id() OR tenant_id IS NULL
 *    - Problem: /auth/login-history only sets user context (no tenant context)
 *    - SSO logins write tenantId, so those rows were hidden from users
 *    - Fix: Allow users to see their own login history regardless of tenant
 *
 * 2. SECURITY DEFINER Function EXECUTE Grants (CRITICAL):
 *    - Previous approach: Grant to current_user (migration role)
 *    - Problem: Migration role may differ from runtime DB_USER
 *    - Fix: Grant to additional standard roles (authenticated, anon) for Supabase
 *           and provide fallback documentation for custom setups
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Fix login_history RLS policy
    // ============================================

    // The old policy was:
    //   app_current_user_id() = 0 OR tenant_id IS NULL OR tenant_id = app_current_tenant_id()
    //
    // This caused SSO login entries (which have tenant_id set) to be hidden
    // because /auth/login-history doesn't set tenant context.
    //
    // New policy: Users can see their own login history regardless of tenant
    await this.db.rawQuery(`DROP POLICY IF EXISTS login_history_tenant_access ON login_history;`)
    await this.db.rawQuery(`
      CREATE POLICY login_history_user_access ON login_history
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR user_id = app_current_user_id()  -- Users see their own history
        );
    `)

    // ============================================
    // 2. Fix SECURITY DEFINER function grants
    // ============================================

    // Grant execute to standard Supabase roles if they exist
    // This handles the case where migrations run as postgres but app runs as authenticated
    await this.db.rawQuery(`
      DO $$
      DECLARE
        authenticated_exists boolean;
        anon_exists boolean;
      BEGIN
        -- Check if authenticated role exists (Supabase)
        SELECT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
        ) INTO authenticated_exists;

        -- Check if anon role exists (Supabase)
        SELECT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'anon'
        ) INTO anon_exists;

        -- Grant to authenticated role if it exists
        IF authenticated_exists THEN
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_current_user_id() TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO authenticated';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO authenticated';
          RAISE NOTICE 'Granted EXECUTE to authenticated role';
        END IF;

        -- Grant to anon role if it exists (for public SSO flows)
        IF anon_exists THEN
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_current_user_id() TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO anon';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO anon';
          RAISE NOTICE 'Granted EXECUTE to anon role';
        END IF;

        -- If neither Supabase role exists, we're likely in a standard Postgres setup
        -- where the same role runs migrations and the app. Log for visibility.
        IF NOT authenticated_exists AND NOT anon_exists THEN
          RAISE NOTICE 'No Supabase roles found. If your app runs as a different role than migrations, manually run:';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_current_user_id() TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO your_app_role;';
          RAISE NOTICE 'GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO your_app_role;';
        END IF;
      END;
      $$;
    `)
  }

  async down(): Promise<void> {
    // Restore old login_history policy
    await this.db.rawQuery(`DROP POLICY IF EXISTS login_history_user_access ON login_history;`)
    await this.db.rawQuery(`
      CREATE POLICY login_history_tenant_access ON login_history
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id IS NULL
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // Revoke from Supabase roles if they exist
    await this.db.rawQuery(`
      DO $$
      DECLARE
        authenticated_exists boolean;
        anon_exists boolean;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
        ) INTO authenticated_exists;

        SELECT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'anon'
        ) INTO anon_exists;

        IF authenticated_exists THEN
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_current_user_id() FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_current_tenant_id() FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_check_user_membership(integer, integer) FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_get_tenant_public(integer) FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_get_invitation_by_token(text) FROM authenticated';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_update_invitation_status(text, text) FROM authenticated';
        END IF;

        IF anon_exists THEN
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_current_user_id() FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_current_tenant_id() FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_check_user_membership(integer, integer) FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_get_tenant_public(integer) FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_get_invitation_by_token(text) FROM anon';
          EXECUTE 'REVOKE EXECUTE ON FUNCTION app_update_invitation_status(text, text) FROM anon';
        END IF;
      END;
      $$;
    `)
  }
}
