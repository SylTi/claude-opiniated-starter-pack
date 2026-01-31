-- CI Schema Audit Script
--
-- This script validates that all plugin tables follow the required invariants:
-- 1. Table has tenant_id column
-- 2. tenant_id is NOT NULL
-- 3. RLS is enabled
-- 4. RLS is forced
-- 5. At least one RLS policy exists
--
-- The query returns rows with violations. If any rows are returned, CI should fail.
--
-- Usage in CI:
--   psql -f scripts/ci-schema-audit.sql -v ON_ERROR_STOP=1
--   # Fails if any violations found

-- Query to find plugin tables with RLS violations
WITH plugin_tables AS (
  -- Find all tables that start with 'plugin_' prefix (our convention)
  SELECT
    c.oid as table_oid,
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'  -- Regular table
    AND c.relname LIKE 'plugin_%'  -- Plugin table prefix
    AND n.nspname = 'public'  -- Assuming public schema
),
tenant_id_check AS (
  -- Check for tenant_id column and its nullable status
  SELECT
    pt.table_name,
    EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_name = pt.table_name
        AND col.column_name = 'tenant_id'
        AND col.table_schema = pt.schema_name
    ) as has_tenant_id,
    (
      SELECT col.is_nullable = 'NO'
      FROM information_schema.columns col
      WHERE col.table_name = pt.table_name
        AND col.column_name = 'tenant_id'
        AND col.table_schema = pt.schema_name
    ) as tenant_id_not_null
  FROM plugin_tables pt
),
policy_count AS (
  -- Count RLS policies per table
  SELECT
    pt.table_name,
    COUNT(pol.polname) as policy_count
  FROM plugin_tables pt
  LEFT JOIN pg_policies pol ON pol.tablename = pt.table_name AND pol.schemaname = pt.schema_name
  GROUP BY pt.table_name
),
violations AS (
  SELECT
    pt.table_name,
    CASE WHEN NOT COALESCE(tc.has_tenant_id, false) THEN 'Missing tenant_id column' END as missing_tenant_id,
    CASE WHEN NOT COALESCE(tc.tenant_id_not_null, false) AND tc.has_tenant_id THEN 'tenant_id is nullable' END as nullable_tenant_id,
    CASE WHEN NOT pt.rls_enabled THEN 'RLS not enabled' END as rls_not_enabled,
    CASE WHEN NOT pt.rls_forced THEN 'RLS not forced' END as rls_not_forced,
    CASE WHEN COALESCE(pc.policy_count, 0) = 0 THEN 'No RLS policies' END as no_policies
  FROM plugin_tables pt
  LEFT JOIN tenant_id_check tc ON tc.table_name = pt.table_name
  LEFT JOIN policy_count pc ON pc.table_name = pt.table_name
)
SELECT
  table_name,
  array_remove(ARRAY[
    missing_tenant_id,
    nullable_tenant_id,
    rls_not_enabled,
    rls_not_forced,
    no_policies
  ], NULL) as violations
FROM violations
WHERE missing_tenant_id IS NOT NULL
   OR nullable_tenant_id IS NOT NULL
   OR rls_not_enabled IS NOT NULL
   OR rls_not_forced IS NOT NULL
   OR no_policies IS NOT NULL;

-- If any rows are returned, the script should fail
-- The calling CI script should check row count
