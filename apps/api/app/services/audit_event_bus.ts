/**
 * Audit Event Bus
 *
 * In-process pub/sub for audit events using Node.js EventEmitter.
 * Provides non-blocking event emission for downstream consumers.
 *
 * @example
 * ```typescript
 * import { auditEventBus } from '#services/audit_event_bus'
 *
 * // Subscribe to all events
 * auditEventBus.subscribe((event) => {
 *   console.log('Audit event:', event)
 * })
 *
 * // Subscribe to specific event type
 * auditEventBus.subscribeToType('auth.login.success', (event) => {
 *   console.log('Login success:', event)
 * })
 * ```
 */

import { EventEmitter } from 'node:events'
import logger from '@adonisjs/core/services/logger'
import type { AuditEvent, AuditEventType } from '@saas/shared'

/**
 * Handler function for audit events.
 */
export type AuditEventHandler = (event: AuditEvent) => void | Promise<void>

/**
 * Internal event name for all audit events.
 */
const ALL_EVENTS_CHANNEL = 'audit:*'

/**
 * Generate channel name for a specific event type.
 */
function getEventChannel(type: AuditEventType): string {
  return `audit:${type}`
}

/**
 * Audit Event Bus implementation using Node.js EventEmitter.
 */
class AuditEventBus {
  private readonly emitter: EventEmitter
  private readonly subscriptions: Map<symbol, { channel: string; handler: AuditEventHandler }>

  constructor() {
    this.emitter = new EventEmitter()
    this.subscriptions = new Map()
    // Increase max listeners to avoid warnings with many subscribers
    this.emitter.setMaxListeners(100)
  }

  /**
   * Subscribe to all audit events.
   *
   * @param handler - Function called for each event
   * @returns Subscription ID for unsubscribing
   */
  subscribe(handler: AuditEventHandler): symbol {
    const id = Symbol('audit-subscription')
    const wrappedHandler = this.wrapHandler(handler)

    this.emitter.on(ALL_EVENTS_CHANNEL, wrappedHandler)
    this.subscriptions.set(id, { channel: ALL_EVENTS_CHANNEL, handler: wrappedHandler })

    return id
  }

  /**
   * Subscribe to a specific event type.
   *
   * @param type - Event type to listen for
   * @param handler - Function called when event occurs
   * @returns Subscription ID for unsubscribing
   */
  subscribeToType(type: AuditEventType, handler: AuditEventHandler): symbol {
    const id = Symbol('audit-subscription')
    const channel = getEventChannel(type)
    const wrappedHandler = this.wrapHandler(handler)

    this.emitter.on(channel, wrappedHandler)
    this.subscriptions.set(id, { channel, handler: wrappedHandler })

    return id
  }

  /**
   * Unsubscribe using a subscription ID.
   *
   * @param subscriptionId - ID returned from subscribe/subscribeToType
   */
  unsubscribe(subscriptionId: symbol): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      return false
    }

    this.emitter.off(subscription.channel, subscription.handler)
    this.subscriptions.delete(subscriptionId)
    return true
  }

  /**
   * Publish an audit event.
   * Non-blocking: uses setImmediate to avoid blocking product flows.
   *
   * @param event - The audit event to publish
   */
  publish(event: AuditEvent): void {
    // Non-blocking emission using setImmediate
    setImmediate(() => {
      // Emit to type-specific channel
      this.emitter.emit(getEventChannel(event.type), event)
      // Emit to catch-all channel
      this.emitter.emit(ALL_EVENTS_CHANNEL, event)
    })
  }

  /**
   * Publish an audit event synchronously (for testing).
   *
   * @param event - The audit event to publish
   */
  publishSync(event: AuditEvent): void {
    this.emitter.emit(getEventChannel(event.type), event)
    this.emitter.emit(ALL_EVENTS_CHANNEL, event)
  }

  /**
   * Get the number of active subscriptions.
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size
  }

  /**
   * Clear all subscriptions (useful for testing).
   */
  clear(): void {
    for (const [id, subscription] of this.subscriptions) {
      this.emitter.off(subscription.channel, subscription.handler)
      this.subscriptions.delete(id)
    }
    this.emitter.removeAllListeners()
  }

  /**
   * Wrap handler to catch and log errors without blocking.
   */
  private wrapHandler(handler: AuditEventHandler): AuditEventHandler {
    return (event: AuditEvent) => {
      try {
        const result = handler(event)
        // Handle async handlers
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error({ err: error, eventType: event.type }, '[AuditEventBus] Handler error')
          })
        }
      } catch (error) {
        logger.error({ err: error, eventType: event.type }, '[AuditEventBus] Handler error')
      }
    }
  }
}

/**
 * Singleton instance of the audit event bus.
 */
export const auditEventBus = new AuditEventBus()

export default AuditEventBus
