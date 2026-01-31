import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Plugin RLS Helper Functions Migration
 *
 * Creates core-owned SQL helper functions for plugin tenant isolation:
 * - app.apply_tenant_rls(_table): Sets RLS and creates 4 policies
 * - app.assert_tenant_scoped_table(_table): Hard fail if invariants violated
 *
 * These functions must exist before any plugin can create tables.
 * Plugins MUST call these functions in their migrations.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // Create app schema if it doesn't exist (for namespacing helper functions)
    await this.db.rawQuery(`CREATE SCHEMA IF NOT EXISTS app;`)

    // Grant usage on app schema to the application role
    await this.db.rawQuery(`GRANT USAGE ON SCHEMA app TO PUBLIC;`)

    /**
     * app.apply_tenant_rls(_table)
     *
     * Enables RLS on a table and creates 4 tenant-scoped policies:
     * - SELECT: tenant_id = app_current_tenant_id()
     * - INSERT: tenant_id = app_current_tenant_id()
     * - UPDATE: tenant_id = app_current_tenant_id()
     * - DELETE: tenant_id = app_current_tenant_id()
     *
     * The table MUST have a tenant_id column of type INTEGER.
     * Uses the existing app_current_tenant_id() function for consistency.
     */
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app.apply_tenant_rls(_table regclass)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        _table_name text;
        _schema_name text;
        _policy_prefix text;
      BEGIN
        -- Extract schema and table name
        SELECT n.nspname, c.relname
        INTO _schema_name, _table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.oid = _table;

        -- Create a policy prefix based on table name (truncated to avoid name length issues)
        _policy_prefix := LEFT(_table_name, 50);

        -- Enable RLS
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', _schema_name, _table_name);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', _schema_name, _table_name);

        -- Create SELECT policy (uses existing app_current_tenant_id() function)
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR SELECT USING (tenant_id = app_current_tenant_id())',
          _policy_prefix || '_tenant_select',
          _schema_name,
          _table_name
        );

        -- Create INSERT policy
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (tenant_id = app_current_tenant_id())',
          _policy_prefix || '_tenant_insert',
          _schema_name,
          _table_name
        );

        -- Create UPDATE policy
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR UPDATE USING (tenant_id = app_current_tenant_id())',
          _policy_prefix || '_tenant_update',
          _schema_name,
          _table_name
        );

        -- Create DELETE policy
        EXECUTE format(
          'CREATE POLICY %I ON %I.%I FOR DELETE USING (tenant_id = app_current_tenant_id())',
          _policy_prefix || '_tenant_delete',
          _schema_name,
          _table_name
        );
      END;
      $$;
    `)

    /**
     * app.assert_tenant_scoped_table(_table)
     *
     * Validates that a table meets all tenant isolation requirements.
     * HARD FAILS (raises exception) if any of these are violated:
     * 1. tenant_id column exists
     * 2. tenant_id is NOT NULL
     * 3. RLS is enabled
     * 4. RLS is forced
     * 5. At least one RLS policy exists
     *
     * Call this AFTER app.apply_tenant_rls() to verify success.
     */
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app.assert_tenant_scoped_table(_table regclass)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      DECLARE
        _table_name text;
        _schema_name text;
        _has_tenant_id boolean;
        _tenant_id_not_null boolean;
        _rls_enabled boolean;
        _rls_forced boolean;
        _policy_count integer;
        _errors text[] := ARRAY[]::text[];
      BEGIN
        -- Extract schema and table name
        SELECT n.nspname, c.relname
        INTO _schema_name, _table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.oid = _table;

        -- Check if tenant_id column exists
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = _schema_name
            AND table_name = _table_name
            AND column_name = 'tenant_id'
        ) INTO _has_tenant_id;

        IF NOT _has_tenant_id THEN
          _errors := array_append(_errors, 'Missing tenant_id column');
        ELSE
          -- Check if tenant_id is NOT NULL
          SELECT is_nullable = 'NO'
          INTO _tenant_id_not_null
          FROM information_schema.columns
          WHERE table_schema = _schema_name
            AND table_name = _table_name
            AND column_name = 'tenant_id';

          IF NOT _tenant_id_not_null THEN
            _errors := array_append(_errors, 'tenant_id column must be NOT NULL');
          END IF;
        END IF;

        -- Check RLS enabled
        SELECT relrowsecurity INTO _rls_enabled
        FROM pg_class WHERE oid = _table;

        IF NOT _rls_enabled THEN
          _errors := array_append(_errors, 'Row Level Security is not enabled');
        END IF;

        -- Check RLS forced
        SELECT relforcerowsecurity INTO _rls_forced
        FROM pg_class WHERE oid = _table;

        IF NOT _rls_forced THEN
          _errors := array_append(_errors, 'Row Level Security is not forced');
        END IF;

        -- Check at least one policy exists
        SELECT COUNT(*) INTO _policy_count
        FROM pg_policies
        WHERE schemaname = _schema_name AND tablename = _table_name;

        IF _policy_count = 0 THEN
          _errors := array_append(_errors, 'No RLS policies found');
        END IF;

        -- Raise exception if any errors
        IF array_length(_errors, 1) > 0 THEN
          RAISE EXCEPTION 'Tenant isolation validation failed for table %.%: %',
            _schema_name, _table_name, array_to_string(_errors, '; ');
        END IF;
      END;
      $$;
    `)

    // Grant execute permissions on these functions
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app.apply_tenant_rls(regclass) TO PUBLIC;`)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app.assert_tenant_scoped_table(regclass) TO PUBLIC;`
    )
  }

  async down(): Promise<void> {
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app.assert_tenant_scoped_table(regclass);`)
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app.apply_tenant_rls(regclass);`)
    // Note: We don't drop the app schema as it might be used by other things
  }
}
