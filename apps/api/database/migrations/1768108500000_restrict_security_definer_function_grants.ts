import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Restrict SECURITY DEFINER Function Grants
 *
 * SECURITY FIX:
 * Previous migration (1768108400000) granted EXECUTE on SECURITY DEFINER functions to PUBLIC.
 * This is problematic because:
 * - SECURITY DEFINER functions bypass RLS (run with owner's privileges)
 * - In Supabase, PUBLIC includes anon and authenticated roles
 * - Direct database access could allow bypassing application authorization
 *
 * This migration:
 * 1. Revokes sensitive functions from PUBLIC
 * 2. Grants to runtime roles (current_user + service_role + postgres fallback)
 * 3. Keeps context getters PUBLIC (needed for RLS policy evaluation)
 *
 * IMPORTANT: Context validation inside functions provides NO security benefit.
 * - Security is enforced by role-based grants (only app can call these functions)
 * - RLS policies already fail closed (NULL context → access denied, not error)
 * - Adding RAISE statements would cause 500 errors instead of clean denials
 *
 * Functions categorized:
 * - SENSITIVE (runtime roles only): Functions that modify data or reveal membership info
 *   - app_is_tenant_member, app_check_user_membership, app_update_invitation_status, app_can_access_invitation
 * - PUBLIC: Context getters and public lookups needed for RLS/public flows
 *   - app_current_user_id, app_current_tenant_id, app_get_tenant_public, app_get_invitation_by_token
 *
 * DEPLOYMENT NOTE - Custom Runtime Roles:
 * This migration grants to: current_user, service_role (Supabase), postgres (common fallback).
 * If your app connects as a DIFFERENT role, you must manually grant after migration:
 *
 *   GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO your_runtime_role;
 *   GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO your_runtime_role;
 *   GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO your_runtime_role;
 *   GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO your_runtime_role;
 *
 * Failure mode: If grants are missing, you'll get immediate permission errors on first request
 * (fail-fast), not silent security issues.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Revoke sensitive functions from PUBLIC
    // ============================================
    // These were granted to PUBLIC by migration 1768108400000
    // Revoking blocks direct access from Supabase anon/authenticated roles

    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_is_tenant_member(integer, integer) FROM PUBLIC;`
    )
    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_check_user_membership(integer, integer) FROM PUBLIC;`
    )
    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_update_invitation_status(text, text) FROM PUBLIC;`
    )
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_can_access_invitation(text) FROM PUBLIC;`)

    // ============================================
    // 2. Grant to runtime roles
    // ============================================
    // Grant to:
    // - current_user: the role running migrations (often same as runtime)
    // - service_role: Supabase service role if present
    // - postgres: common fallback for Docker and Supabase deployments

    await this.db.rawQuery(`
      DO $$
      DECLARE
        app_role text := current_user;
      BEGIN
        -- Grant to current user (migration role, often same as runtime)
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO %I', app_role);

        -- Grant to Supabase service_role if it exists
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO service_role';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO service_role';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO service_role';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO service_role';
        END IF;

        -- Grant to postgres as fallback (common runtime role in Docker and Supabase)
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO postgres';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO postgres';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO postgres';
          EXECUTE 'GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO postgres';
        END IF;
      END $$;
    `)

    // ============================================
    // 3. Keep PUBLIC for context getters (needed for RLS)
    // ============================================
    // These are already PUBLIC from previous migration (1768108400000)
    // No changes needed for:
    // - app_current_user_id() - reads app.user_id session var
    // - app_current_tenant_id() - reads app.tenant_id session var
    // - app_get_tenant_public(integer) - public tenant info lookup
    // - app_get_invitation_by_token(text) - public invitation display

    // ============================================
    // 4. Ensure functions have NO context validation
    // ============================================
    // Restore clean versions without RAISE statements.
    // Context validation adds no security benefit and causes 500 errors
    // instead of clean access denials.

    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_is_tenant_member(check_tenant_id integer, check_user_id integer)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM tenant_memberships m
          WHERE m.tenant_id = check_tenant_id
            AND m.user_id = check_user_id
        )
      $$;
    `)

    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_check_user_membership(p_tenant_id integer, p_user_id integer)
      RETURNS TABLE(id integer, tenant_id integer, user_id integer, role text)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT m.id, m.tenant_id, m.user_id, m.role::text
        FROM tenant_memberships m
        WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
        LIMIT 1
      $$;
    `)

    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_update_invitation_status(p_token text, p_status text)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
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

    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_can_access_invitation(invitation_email text)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = app_current_user_id()
            AND LOWER(u.email) = LOWER(invitation_email)
        )
      $$;
    `)

    // Add documentation comments
    await this.db.rawQuery(`
      COMMENT ON FUNCTION app_is_tenant_member(integer, integer) IS
        'Checks if a user is a member of a tenant. SECURITY DEFINER.
         Restricted to runtime roles only (not PUBLIC).
         Returns FALSE for NULL inputs (fail-closed).';
    `)

    await this.db.rawQuery(`
      COMMENT ON FUNCTION app_check_user_membership(integer, integer) IS
        'Returns membership details for tenant context middleware. SECURITY DEFINER.
         Called before RLS context is set - must work without app.user_id.
         Restricted to runtime roles only (not PUBLIC).';
    `)

    await this.db.rawQuery(`
      COMMENT ON FUNCTION app_update_invitation_status(text, text) IS
        'Updates invitation status by token. SECURITY DEFINER.
         Called by public invitation endpoint - must work without app.user_id.
         Restricted to runtime roles only (not PUBLIC).';
    `)

    await this.db.rawQuery(`
      COMMENT ON FUNCTION app_can_access_invitation(text) IS
        'Checks if current user can access invitation by email match. SECURITY DEFINER.
         Used in RLS policy - returns FALSE when app.user_id is NULL (fail-closed).
         Restricted to runtime roles only (not PUBLIC).';
    `)
  }

  async down(): Promise<void> {
    // Restore PUBLIC grants (previous state from 1768108400000)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO PUBLIC;`
    )
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO PUBLIC;`)

    // Remove comments
    await this.db.rawQuery(`COMMENT ON FUNCTION app_is_tenant_member(integer, integer) IS NULL;`)
    await this.db.rawQuery(
      `COMMENT ON FUNCTION app_check_user_membership(integer, integer) IS NULL;`
    )
    await this.db.rawQuery(`COMMENT ON FUNCTION app_update_invitation_status(text, text) IS NULL;`)
    await this.db.rawQuery(`COMMENT ON FUNCTION app_can_access_invitation(text) IS NULL;`)
  }
}
