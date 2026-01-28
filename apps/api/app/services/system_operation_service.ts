import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { setRlsContext, setSystemRlsContext } from '#utils/rls_context'
import User from '#models/user'
import ProcessedWebhookEvent from '#models/processed_webhook_event'
import { DateTime } from 'luxon'

/**
 * Centralized service for privileged system operations that bypass RLS.
 *
 * SECURITY CONSIDERATIONS:
 * ========================
 * This service contains operations that intentionally bypass Row-Level Security.
 * These are necessary for system maintenance and cross-tenant cleanup operations
 * that cannot be performed within normal RLS constraints.
 *
 * WHEN TO USE THIS SERVICE:
 * - Tenant deletion cleanup (clearing other users' currentTenantId)
 * - Webhook event cleanup (system-level data not scoped to any tenant)
 * - Cross-tenant maintenance operations (after proper authorization checks)
 * - Scheduled job operations that span multiple tenants
 *
 * WHEN NOT TO USE THIS SERVICE:
 * - Normal CRUD operations (use models with automatic RLS binding)
 * - Operations that should respect user/tenant scope
 * - Any operation where the current user's context should apply
 *
 * ADDING NEW METHODS:
 * 1. Document the security justification for bypassing RLS
 * 2. Ensure authorization is checked BEFORE calling this service
 * 3. Log the operation for audit trail
 * 4. Keep operations atomic within transactions
 */
export default class SystemOperationService {
  /**
   * Clear currentTenantId for all members of a tenant being deleted.
   *
   * SECURITY JUSTIFICATION:
   * - This operation is only called during tenant deletion
   * - RBAC must verify TENANT_DELETE permission (owner only) BEFORE calling
   * - We need to update OTHER users' records, which RLS cannot allow
   * - Without this, deleted tenant's users would have an invalid currentTenantId
   *
   * @param tenantId - The tenant being deleted
   * @param callerUserId - The user performing the deletion (for audit trail)
   */
  async clearMembersCurrentTenant(tenantId: number, callerUserId: number): Promise<number> {
    return await db.transaction(async (trx) => {
      // Set system RLS context (user_id=0, tenant_id=0)
      // This allows bypassing user-scoped RLS policies
      await setSystemRlsContext(trx)

      // Count affected users for audit
      const countResult = await User.query({ client: trx })
        .where('currentTenantId', tenantId)
        .count('* as total')

      const affectedCount = Number(countResult[0]?.$extras?.total ?? 0)

      // Clear currentTenantId for all members
      // Note: Using query builder update() which bypasses model hooks
      // This is intentional - we need to update multiple records atomically
      await trx
        .from('users')
        .where('current_tenant_id', tenantId)
        .update({ current_tenant_id: null })

      logger.info(
        { tenantId, callerUserId, affectedUsers: affectedCount },
        'Cleared currentTenantId for tenant members during deletion'
      )

      return affectedCount
    })
  }

  /**
   * Clean up old processed webhook events.
   *
   * SECURITY JUSTIFICATION:
   * - Webhook events are system-level data, not scoped to any user or tenant
   * - This is a maintenance operation, typically run by scheduled jobs
   * - No user authorization is needed as this doesn't access user data
   *
   * @param daysOld - Delete events older than this many days (default: 30)
   * @returns Number of deleted events
   */
  async cleanupOldWebhookEvents(daysOld: number = 30): Promise<number> {
    const cutoff = DateTime.now().minus({ days: daysOld })

    // No transaction needed - single atomic delete
    const result = await ProcessedWebhookEvent.query()
      .where('processedAt', '<', cutoff.toSQL())
      .delete()

    const deletedCount = result[0] ?? 0

    logger.info(
      { daysOld, deletedCount, cutoffDate: cutoff.toISO() },
      'Cleaned up old webhook events'
    )

    return deletedCount
  }

  /**
   * Execute an operation with system RLS context (user_id=0, tenant_id=0).
   *
   * Use this for operations that need to query across tenants or access
   * system-level data before determining the specific tenant context.
   *
   * SECURITY JUSTIFICATION:
   * - Used for initial lookups in webhooks before tenant is known
   * - RLS policies must explicitly allow system identity (user_id=0)
   *
   * @param callback - Function to execute with system context
   * @returns Result of the callback
   */
  async withSystemContext<T>(callback: (trx: TransactionClientContract) => Promise<T>): Promise<T> {
    return await db.transaction(async (trx) => {
      await setSystemRlsContext(trx)
      return callback(trx)
    })
  }

  /**
   * Execute an operation with specific tenant RLS context.
   *
   * Use this for webhook handlers or background jobs that need to
   * operate on a specific tenant's data outside of HttpContext.
   *
   * SECURITY JUSTIFICATION:
   * - Used when HttpContext is not available (webhooks, scheduled jobs)
   * - The tenantId should come from verified data (e.g., Stripe webhook payload)
   * - userId defaults to 0 (system) unless a specific user context is needed
   *
   * @param tenantId - The tenant to set context for
   * @param callback - Function to execute with tenant context
   * @param userId - Optional user ID (defaults to 0 for system operations)
   * @returns Result of the callback
   */
  async withTenantContext<T>(
    tenantId: number,
    callback: (trx: TransactionClientContract) => Promise<T>,
    userId?: number
  ): Promise<T> {
    return await db.transaction(async (trx) => {
      await setRlsContext(trx, tenantId, userId)
      return callback(trx)
    })
  }

  /**
   * Execute a cross-tenant lookup followed by tenant-scoped operations.
   *
   * Common pattern for webhooks:
   * 1. Start with system context to find the relevant tenant
   * 2. Switch to tenant context for the actual operations
   *
   * SECURITY JUSTIFICATION:
   * - Webhooks receive data without tenant context
   * - Need system context to find which tenant the event relates to
   * - After identifying tenant, operations should be tenant-scoped
   *
   * @param lookupFn - Function to determine tenant ID using system context
   * @param operationFn - Function to execute with tenant context
   * @returns Result of the operation function
   */
  async lookupThenOperate<T>(
    lookupFn: (trx: TransactionClientContract) => Promise<number | null>,
    operationFn: (trx: TransactionClientContract, tenantId: number) => Promise<T>
  ): Promise<T | null> {
    return await db.transaction(async (trx) => {
      // Phase 1: System context for lookup
      await setSystemRlsContext(trx)
      const tenantId = await lookupFn(trx)

      if (tenantId === null) {
        return null
      }

      // Phase 2: Switch to tenant context for operations
      await setRlsContext(trx, tenantId)
      return operationFn(trx, tenantId)
    })
  }
}

/**
 * Singleton instance of SystemOperationService.
 *
 * Import this for convenience:
 *   import { systemOps } from '#services/system_operation_service'
 */
export const systemOps = new SystemOperationService()
