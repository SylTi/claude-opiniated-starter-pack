import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix SECURITY DEFINER functions to restore original user context
 *
 * The previous migration set app.user_id = 0 to bypass RLS but didn't restore
 * the original value. This caused the user context to be lost for subsequent
 * operations in the same transaction.
 *
 * This migration fixes app_is_tenant_member and app_check_user_membership to
 * save and restore the original user_id value.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Fix app_is_tenant_member() to restore original context
    // ============================================
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
    // 2. Fix app_check_user_membership() to restore original context
    // ============================================
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
    // Restore versions without context restoration (from previous migration)
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
      BEGIN
        PERFORM set_config('app.user_id', '0', true);

        SELECT EXISTS (
          SELECT 1 FROM tenant_memberships m
          WHERE m.tenant_id = check_tenant_id
            AND m.user_id = check_user_id
        ) INTO result;

        RETURN result;
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
      BEGIN
        PERFORM set_config('app.user_id', '0', true);

        RETURN QUERY
        SELECT m.id, m.tenant_id, m.user_id, m.role::text
        FROM tenant_memberships m
        WHERE m.tenant_id = p_tenant_id AND m.user_id = p_user_id
        LIMIT 1;
      END;
      $$;
    `)
  }
}
