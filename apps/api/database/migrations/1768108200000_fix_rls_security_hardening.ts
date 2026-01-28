import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix RLS Security Hardening
 *
 * This migration addresses SECURITY DEFINER function hardening:
 *
 * 1. Functions lack SET search_path (risk of search_path manipulation)
 * 2. Functions lack explicit privilege scoping (REVOKE/GRANT)
 *
 * DESIGN PRINCIPLE: Fail-closed by default
 * - app_current_user_id() returns NULL when not set (denies access)
 * - System bypass (user_id=0) must be set EXPLICITLY via systemOps.withSystemContext()
 * - This prevents accidental RLS bypass on new/forgotten routes
 *
 * Public flows that need RLS access must explicitly use:
 * - systemOps.withSystemContext() for cross-tenant lookups
 * - systemOps.withTenantContext() for tenant-scoped operations
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Harden app_current_user_id() with search_path (keep NULL default for fail-closed)
    // ============================================
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_user_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      SET search_path = public
      AS $$
        SELECT nullif(current_setting('app.user_id', true), '')::integer
      $$;
    `)

    // Restrict execute privilege - revoke from PUBLIC, will grant to app role
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_current_user_id() FROM PUBLIC;`)

    // ============================================
    // 2. Fix app_current_tenant_id() with search_path
    // ============================================
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_tenant_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      SET search_path = public
      AS $$
        SELECT nullif(current_setting('app.tenant_id', true), '')::integer
      $$;
    `)

    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_current_tenant_id() FROM PUBLIC;`)

    // ============================================
    // 3. Harden app_is_tenant_member() with search_path and privileges
    // ============================================
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

    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_is_tenant_member(integer, integer) FROM PUBLIC;`
    )

    // ============================================
    // 4. Harden app_check_user_membership() with search_path and privileges
    // ============================================
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

    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_check_user_membership(integer, integer) FROM PUBLIC;`
    )

    // ============================================
    // 5. Harden app_get_tenant_public() with search_path and privileges
    // ============================================
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_get_tenant_public(p_tenant_id integer)
      RETURNS TABLE(id integer, name text, slug text)
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT t.id, t.name, t.slug
        FROM tenants t
        WHERE t.id = p_tenant_id
        LIMIT 1
      $$;
    `)

    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_get_tenant_public(integer) FROM PUBLIC;`)

    // ============================================
    // 6. Harden app_get_invitation_by_token() with search_path and privileges
    // ============================================
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
      SET search_path = public
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

    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_get_invitation_by_token(text) FROM PUBLIC;`)

    // ============================================
    // 7. Harden app_update_invitation_status() with search_path and privileges
    // ============================================
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

    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_update_invitation_status(text, text) FROM PUBLIC;`
    )

    // ============================================
    // 8. Grant EXECUTE to app role
    // ============================================
    // We need to grant execute to the role that runs the application.
    // Options:
    // 1. CURRENT_USER - works if migrations run under the same role as the app
    // 2. SESSION_USER - the role that initiated the session
    // 3. Specific role name - requires knowing the role name
    //
    // We use a DO block to grant to CURRENT_USER, which covers most deployment scenarios.
    // If migrations run under a different role (e.g., superuser), you may need to
    // manually grant to the app role:
    //   GRANT EXECUTE ON FUNCTION app_current_user_id() TO your_app_role;
    //
    // Note: Function owner always retains EXECUTE privilege regardless of REVOKE.
    await this.db.rawQuery(`
      DO $$
      DECLARE
        app_role text := current_user;
      BEGIN
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_current_user_id() TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO %I', app_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO %I', app_role);
      END;
      $$;
    `)
  }

  async down(): Promise<void> {
    // Restore original functions without hardening

    // Restore app_current_user_id (returns NULL when not set)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_user_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      AS $$
        SELECT nullif(current_setting('app.user_id', true), '')::integer
      $$;
    `)

    // Restore app_current_tenant_id
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_current_tenant_id()
      RETURNS integer
      LANGUAGE sql
      STABLE
      AS $$
        SELECT nullif(current_setting('app.tenant_id', true), '')::integer
      $$;
    `)

    // Restore app_is_tenant_member without hardening
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

    // Restore app_check_user_membership without hardening
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

    // Restore app_get_tenant_public without hardening
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

    // Restore app_get_invitation_by_token without hardening
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

    // Restore app_update_invitation_status without hardening
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

    // Restore public execute on all functions
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_current_user_id() TO PUBLIC;`)
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO PUBLIC;`)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO PUBLIC;`)
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO PUBLIC;`)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO PUBLIC;`
    )
  }
}
