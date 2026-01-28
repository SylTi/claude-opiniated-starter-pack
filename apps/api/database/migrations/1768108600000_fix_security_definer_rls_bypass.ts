import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix SECURITY DEFINER functions to properly bypass RLS
 *
 * PostgreSQL's SECURITY DEFINER does NOT automatically bypass RLS.
 * The function owner must still pass RLS checks unless they have BYPASSRLS privilege.
 *
 * Solution: Convert SQL functions to plpgsql and use set_config() to temporarily
 * set app.user_id = 0 (system bypass) within the function scope.
 *
 * IMPORTANT: For functions called during authenticated requests (app_is_tenant_member,
 * app_check_user_membership), we must save and restore the original user_id to avoid
 * breaking subsequent RLS checks in the same transaction.
 *
 * This affects public-facing functions that need to query RLS-protected tables
 * without a user context:
 * - app_get_tenant_public() - SSO check endpoint (no user context expected)
 * - app_get_invitation_by_token() - Invitation lookup (no user context expected)
 * - app_is_tenant_member() - RLS policy helper (called in auth context, must restore)
 * - app_check_user_membership() - Middleware helper (called in auth context, must restore)
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Fix app_get_tenant_public() to bypass RLS
    // ============================================
    // This is called from public endpoints (SSO check) where no user context exists
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_get_tenant_public(p_tenant_id integer)
      RETURNS TABLE(id integer, name text, slug text)
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- Set system user to bypass RLS (this is a public endpoint, no user context)
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
        SELECT t.id, t.name, t.slug
        FROM tenants t
        WHERE t.id = p_tenant_id
        LIMIT 1;
      END;
      $$;
    `)

    // ============================================
    // 2. Fix app_get_invitation_by_token() to bypass RLS
    // ============================================
    // This is called from public endpoints where no user context exists
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
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- Set system user to bypass RLS (this is a public endpoint, no user context)
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
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
        LIMIT 1;
      END;
      $$;
    `)

    // ============================================
    // 3. Fix app_is_tenant_member() to bypass RLS
    // ============================================
    // This function is called during authenticated requests (in RLS policies and middleware).
    // We must save and restore the original user_id to avoid breaking subsequent RLS checks.
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_is_tenant_member(check_tenant_id integer, check_user_id integer)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        result boolean;
        original_user_id text;
      BEGIN
        -- Save original user_id (may be NULL or empty)
        original_user_id := current_setting('app.user_id', true);

        -- Temporarily set system user to bypass RLS on tenant_memberships
        PERFORM set_config('app.user_id', '0', true);

        SELECT EXISTS (
          SELECT 1 FROM tenant_memberships m
          WHERE m.tenant_id = check_tenant_id
            AND m.user_id = check_user_id
        ) INTO result;

        -- Restore original user_id
        IF original_user_id IS NOT NULL AND original_user_id != '' THEN
          PERFORM set_config('app.user_id', original_user_id, true);
        ELSE
          PERFORM set_config('app.user_id', '', true);
        END IF;

        RETURN result;
      END;
      $$;
    `)

    // ============================================
    // 4. Fix app_check_user_membership() to bypass RLS
    // ============================================
    // This function is called during authenticated requests (in middleware).
    // We must save and restore the original user_id.
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_check_user_membership(p_tenant_id integer, p_user_id integer)
      RETURNS TABLE(id integer, tenant_id integer, user_id integer, role text)
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        original_user_id text;
      BEGIN
        -- Save original user_id (may be NULL or empty)
        original_user_id := current_setting('app.user_id', true);

        -- Temporarily set system user to bypass RLS
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
        SELECT m.id, m.tenant_id, m.user_id, m.role::text
        FROM tenant_memberships m
        WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
        LIMIT 1;

        -- Restore original user_id
        IF original_user_id IS NOT NULL AND original_user_id != '' THEN
          PERFORM set_config('app.user_id', original_user_id, true);
        ELSE
          PERFORM set_config('app.user_id', '', true);
        END IF;
      END;
      $$;
    `)
  }

  async down(): Promise<void> {
    // Restore original SQL versions (without RLS bypass)
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
  }
}
