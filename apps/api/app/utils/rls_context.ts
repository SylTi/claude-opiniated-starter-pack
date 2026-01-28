import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * RLS Context Utilities for System Operations
 *
 * These helpers set PostgreSQL session variables for RLS when operating
 * outside HttpContext (webhooks, scheduled jobs, background tasks).
 *
 * IMPORTANT: user_id = 0 is reserved as the SYSTEM IDENTITY
 * ---------------------------------------------------------
 * When no real user is involved (webhooks, system processes), user_id is set to 0.
 * RLS policies MUST handle this case explicitly:
 *
 *   -- Example: Allow system (user_id = 0) to bypass user-specific checks
 *   CREATE POLICY example_policy ON some_table
 *   USING (
 *     COALESCE(current_setting('app.user_id', true), '0')::int = 0  -- system bypass
 *     OR user_id = current_setting('app.user_id', true)::int        -- normal user check
 *   );
 *
 * If a policy assumes app.user_id is always a real user (> 0), system operations
 * will be blocked. Always test RLS policies with user_id = 0.
 */

/**
 * Set RLS context on a transaction for system/webhook operations.
 *
 * This is used when operating outside HttpContext (webhooks, scheduled jobs)
 * where the automatic RLS binding from BaseModel doesn't apply.
 *
 * @param trx - The transaction to set context on
 * @param tenantId - The tenant ID to set (required for tenant-scoped tables)
 * @param userId - Optional user ID (for user-scoped tables, defaults to 0 = system)
 */
export async function setRlsContext(
  trx: TransactionClientContract,
  tenantId: number,
  userId?: number
): Promise<void> {
  // Set tenant context (required for tenant-scoped RLS policies)
  await trx.rawQuery("SELECT set_config('app.tenant_id', ?, true)", [String(tenantId)])

  // Set user context if provided, otherwise use 0 (system identity)
  // IMPORTANT: RLS policies must explicitly handle user_id = 0 for system operations
  const effectiveUserId = userId ?? 0
  await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(effectiveUserId)])
}

/**
 * Set RLS context for system operations that don't have a specific tenant.
 * This sets user_id=0 and tenant_id=0 as the SYSTEM IDENTITY.
 *
 * Use this for:
 * - Webhook handlers that need to lookup records before knowing the tenant
 * - Scheduled jobs that operate across tenants
 * - System maintenance operations
 *
 * IMPORTANT: RLS policies MUST include a system bypass clause:
 *   OR current_setting('app.user_id', true) = '0'
 *
 * After determining the tenant, call setRlsContext(trx, tenantId) to
 * switch to proper tenant-scoped context.
 */
export async function setSystemRlsContext(trx: TransactionClientContract): Promise<void> {
  await trx.rawQuery("SELECT set_config('app.user_id', '0', true)")
  await trx.rawQuery("SELECT set_config('app.tenant_id', '0', true)")
}
