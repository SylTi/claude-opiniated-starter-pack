import { BaseModel as LucidBaseModel } from '@adonisjs/lucid/orm'
import { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'

type QueryWithClient = {
  client?: {
    isTransaction?: boolean
  }
}

function hasTransactionClient(query: unknown): query is QueryWithClient {
  return typeof query === 'object' && query !== null && 'client' in query
}

/**
 * Mixin that adds automatic RLS transaction binding to models.
 *
 * When a request is wrapped in a tenant or auth context middleware,
 * all queries automatically use the transaction where RLS session
 * variables (app.user_id, app.tenant_id) are set.
 *
 * This ensures RLS is enforced without developers needing to explicitly
 * pass transactions to every query.
 */
function withRlsContext<T extends NormalizeConstructor<typeof LucidBaseModel>>(superclass: T) {
  class ModelWithRls extends superclass {
    /**
     * Get the RLS transaction from HttpContext if available.
     */
    static getRlsTransaction(): TransactionClientContract | undefined {
      const ctx = HttpContext.get()
      if (!ctx) return undefined
      // Prefer tenantDb (has both user_id and tenant_id) over authDb (user_id only)
      return ctx.tenantDb ?? ctx.authDb
    }

    /**
     * Boot hook to set up automatic RLS binding via query hooks.
     */
    static boot(): void {
      if (this.booted) return
      super.boot()

      // Hook into all query operations to bind RLS transaction
      // This covers: find, fetch (which includes update/delete via query builder)
      const queryEvents = ['find', 'fetch'] as const
      for (const event of queryEvents) {
        this.before(event, (query) => {
          // Don't override if already using a transaction
          if (hasTransactionClient(query) && query.client?.isTransaction) return

          const trx = this.getRlsTransaction()
          if (trx) {
            query.useTransaction(trx)
          }
        })
      }
    }

    /**
     * Instance save() - uses RLS transaction if available.
     */
    async save(): Promise<this> {
      if (!this.$trx) {
        const trx = (this.constructor as typeof ModelWithRls).getRlsTransaction()
        if (trx) {
          this.useTransaction(trx)
        }
      }
      return super.save()
    }

    /**
     * Instance delete() - uses RLS transaction if available.
     */
    async delete(): Promise<void> {
      if (!this.$trx) {
        const trx = (this.constructor as typeof ModelWithRls).getRlsTransaction()
        if (trx) {
          this.useTransaction(trx)
        }
      }
      return super.delete()
    }

    /**
     * Create multiple rows with RLS context.
     *
     * Standard createMany() creates its own transaction internally,
     * which means it doesn't inherit the RLS context from HttpContext.
     * This method ensures the RLS transaction is used.
     *
     * IMPORTANT: This method requires an active RLS context from HttpContext
     * (via AuthContextMiddleware or TenantContextMiddleware). If no context
     * is available, it throws an error to prevent silent RLS bypass.
     *
     * For system operations outside HttpContext, use:
     *   Model.createMany([...], { client: trx })
     *
     * @param values - Array of objects to insert
     * @returns Array of created model instances
     * @throws Error if no RLS transaction is available
     */
    static async createManyWithRls<TModel extends typeof ModelWithRls>(
      this: TModel,
      values: Partial<ModelAttributes<InstanceType<TModel>>>[]
    ): Promise<InstanceType<TModel>[]> {
      const trx = this.getRlsTransaction()

      if (!trx) {
        throw new Error(
          `${this.name}.createManyWithRls() requires an active RLS context from HttpContext. ` +
            `Ensure the request goes through AuthContextMiddleware or TenantContextMiddleware. ` +
            `For system operations, use ${this.name}.createMany([...], { client: trx }) instead.`
        )
      }

      return this.createMany(values as Partial<ModelAttributes<InstanceType<TModel>>>[], {
        client: trx,
      })
    }
  }

  return ModelWithRls
}

/**
 * Base model with automatic RLS transaction binding.
 *
 * All models should extend this class to get automatic RLS enforcement.
 *
 * COVERED (automatic RLS via HttpContext):
 * ----------------------------------------
 * - Model.query().where(...).first() ✅ (via 'find' hook)
 * - Model.query().where(...).fetch() ✅ (via 'fetch' hook)
 * - Model.find(id) ✅ (uses query internally)
 * - Model.findOrFail(id) ✅ (uses query internally)
 * - Model.create({...}) ✅ (calls save() internally)
 * - instance.save() ✅ (overridden)
 * - instance.delete() ✅ (overridden)
 * - Model.createManyWithRls([...]) ✅ (RLS-aware wrapper)
 *
 * NOT COVERED (requires explicit handling):
 * -----------------------------------------
 * - Model.query().where(...).update({...}) ❌ Query builder update bypasses hooks
 * - Model.query().where(...).delete() ❌ Query builder delete bypasses hooks
 * - Model.createMany([...]) ⚠️ Creates own transaction without RLS context
 * - Raw queries ❌ Use ctx.tenantDb explicitly
 *
 * For query builder writes, either:
 * 1. Convert to instance methods: fetch rows, modify, call save()/delete()
 * 2. Use ctx.tenantDb explicitly: Model.query({ client: ctx.tenantDb }).update()
 * 3. For webhooks/system ops: use setRlsContext() from #utils/rls_context
 * 4. Use SystemOperationService for privileged cross-tenant operations
 *
 * For createMany in authenticated context, use:
 *   Model.createManyWithRls([...])  // Automatically uses RLS context
 * Or for system operations:
 *   Model.createMany([...], { client: trx })  // Explicit transaction
 */
const BaseModel = withRlsContext(LucidBaseModel)
export default BaseModel
