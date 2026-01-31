/**
 * AuthzService
 *
 * Single choke point for plugin authorization.
 * Routes authorization checks to the appropriate resolver based on namespace.
 *
 * BEHAVIOR:
 * - Extract namespace from ability (up to first dot)
 * - Route to registered plugin resolver OR default deny
 * - Core abilities (no dot) are delegated to existing RBAC
 */

import type { AuthzCheck, AuthzContext, AuthzDecision } from '@saas/shared'
import { parseNamespace, isCoreAbility } from '@saas/shared'
import { AuthzDeniedError } from '#exceptions/authz_errors'
import { NamespaceRegistry, namespaceRegistry } from './namespace_registry.js'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '@saas/shared'

/**
 * Authorization Service for plugin authorization checks.
 */
export default class AuthzService {
  private registry: NamespaceRegistry

  /**
   * Constructor allows dependency injection for testing.
   * Falls back to the global namespaceRegistry if none provided.
   */
  constructor(registry?: NamespaceRegistry) {
    this.registry = registry ?? namespaceRegistry
  }
  /**
   * Check if an ability is allowed.
   * Returns an AuthzDecision with allow/deny and reason.
   *
   * FAIL-CLOSED: If no resolver is found, returns deny.
   */
  async check(ctx: AuthzContext, check: AuthzCheck): Promise<AuthzDecision> {
    // Parse namespace from ability
    const namespace = parseNamespace(check.ability)

    // Core abilities are not handled by this service
    if (isCoreAbility(check.ability)) {
      // Return a decision indicating this should be handled by core RBAC
      return {
        allow: false,
        reason: 'Core ability - use RBAC service',
      }
    }

    // Add dot to namespace for lookup
    const namespaceWithDot = `${namespace}.`

    // Get resolver for namespace
    const resolver = this.registry.getResolver(namespaceWithDot)

    if (!resolver) {
      // FAIL-CLOSED: No resolver = deny
      return {
        allow: false,
        reason: `No authorization resolver for namespace "${namespace}"`,
      }
    }

    try {
      // Call the plugin's resolver
      const decision = await resolver(ctx, check)

      // Emit audit event for significant authz decisions
      if (!decision.allow) {
        await this.emitDeniedEvent(ctx, check, decision.reason)
      }

      return decision
    } catch (error) {
      // FAIL-CLOSED: Resolver error = deny
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[AuthzService] Resolver error for ${check.ability}:`, error)

      return {
        allow: false,
        reason: `Authorization resolver error: ${errorMessage}`,
      }
    }
  }

  /**
   * Check if an ability is allowed and throw if denied.
   * @throws {AuthzDeniedError} If authorization is denied
   */
  async authorize(ctx: AuthzContext, check: AuthzCheck): Promise<void> {
    const decision = await this.check(ctx, check)

    if (!decision.allow) {
      throw new AuthzDeniedError(check, decision.reason)
    }
  }

  /**
   * Check multiple abilities in parallel, returns individual decisions for each.
   * Results are returned in the same order as the input checks.
   */
  async checkAll(ctx: AuthzContext, checks: AuthzCheck[]): Promise<AuthzDecision[]> {
    return Promise.all(checks.map((check) => this.check(ctx, check)))
  }

  /**
   * Authorize multiple abilities, all must be allowed.
   * @throws {AuthzDeniedError} If any authorization is denied
   */
  async authorizeAll(ctx: AuthzContext, checks: AuthzCheck[]): Promise<void> {
    for (const check of checks) {
      await this.authorize(ctx, check)
    }
  }

  /**
   * Check multiple abilities, at least one must be allowed.
   */
  async checkAny(ctx: AuthzContext, checks: AuthzCheck[]): Promise<AuthzDecision> {
    const deniedReasons: string[] = []

    for (const check of checks) {
      const decision = await this.check(ctx, check)
      if (decision.allow) {
        return { allow: true }
      }
      if (decision.reason) {
        deniedReasons.push(decision.reason)
      }
    }

    return {
      allow: false,
      reason: `All checks denied: ${deniedReasons.join('; ')}`,
    }
  }

  /**
   * Check if a namespace has a registered resolver.
   */
  hasResolver(namespace: string): boolean {
    const namespaceWithDot = namespace.endsWith('.') ? namespace : `${namespace}.`
    return this.registry.has(namespaceWithDot)
  }

  /**
   * Get all registered namespaces.
   */
  getRegisteredNamespaces(): string[] {
    return this.registry.getAllNamespaces()
  }

  /**
   * Emit an audit event for denied authorization.
   */
  private async emitDeniedEvent(
    ctx: AuthzContext,
    check: AuthzCheck,
    reason?: string
  ): Promise<void> {
    try {
      await auditEventEmitter.emit({
        tenantId: ctx.tenantId,
        type: AUDIT_EVENT_TYPES.AUTHZ_DENIED,
        actor: {
          type: 'user',
          id: ctx.userId,
        },
        resource: check.resource
          ? {
              type: check.resource.type,
              id: check.resource.id,
            }
          : undefined,
        meta: {
          ability: check.ability,
          reason,
          namespace: parseNamespace(check.ability),
        },
      })
    } catch (error) {
      // Don't fail the authorization check if audit fails
      console.error('[AuthzService] Failed to emit audit event:', error)
    }
  }
}

/**
 * Global authz service instance.
 */
export const authzService = new AuthzService()
