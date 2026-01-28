import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix SECURITY DEFINER functions return type casting
 *
 * PostgreSQL plpgsql functions with TABLE return types require exact type matching.
 * The tenants table uses varchar columns, but our functions declared text return types.
 * This migration adds explicit casts to ensure type compatibility.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // Fix app_get_tenant_public() to cast varchar to text
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
        SELECT t.id, t.name::text, t.slug::text
        FROM tenants t
        WHERE t.id = p_tenant_id
        LIMIT 1;
      END;
      $$;
    `)

    // Fix app_get_invitation_by_token() to cast varchar to text
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
          i.email::text,
          i.role::text,
          i.status::text,
          i.expires_at,
          i.invited_by_id,
          t.name::text as tenant_name,
          t.slug::text as tenant_slug,
          u.full_name::text as inviter_full_name,
          u.email::text as inviter_email
        FROM tenant_invitations i
        JOIN tenants t ON t.id = i.tenant_id
        LEFT JOIN users u ON u.id = i.invited_by_id
        WHERE i.token = p_token
        LIMIT 1;
      END;
      $$;
    `)

    // Fix app_check_user_membership() to cast varchar to text
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
    // Restore versions without explicit casting (from previous migration)
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_get_tenant_public(p_tenant_id integer)
      RETURNS TABLE(id integer, name text, slug text)
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
        SELECT t.id, t.name, t.slug
        FROM tenants t
        WHERE t.id = p_tenant_id
        LIMIT 1;
      END;
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
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
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
        original_user_id := current_setting('app.user_id', true);
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
        SELECT m.id, m.tenant_id, m.user_id, m.role::text
        FROM tenant_memberships m
        WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
        LIMIT 1;

        IF original_user_id IS NOT NULL AND original_user_id != '' THEN
          PERFORM set_config('app.user_id', original_user_id, true);
        ELSE
          PERFORM set_config('app.user_id', '', true);
        END IF;
      END;
      $$;
    `)
  }
}
