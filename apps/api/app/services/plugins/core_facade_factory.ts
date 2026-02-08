import { HttpContext } from '@adonisjs/core/http'
import type { HttpContext as AdonisHttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  BootPermissionsRegistrar,
  CoreFacadeFactory,
  NotificationPayload,
  PermissionsFacade,
  PluginHttpContext,
  PluginManifest,
  RequestScopedFacades,
  ResourceResolverContext,
  UsersFacade,
} from '@saas/plugins-core'
import { StaleFacadeUsageError } from '@saas/plugins-core'
import { hookRegistry } from '@saas/plugins-core'
import TenantMembership from '#models/tenant_membership'
import { authzService } from '#services/authz/authz_service'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '@saas/shared'
import { notificationService } from '#services/notifications/notification_service'
import { pluginAbilityRegistry } from './plugin_ability_registry.js'
import { pluginPermissionGrantService } from './plugin_permission_grant_service.js'
import { resourceProviderRegistry } from './resource_provider_registry.js'

const CAP_USERS = 'core:service:users:read'
const CAP_RESOURCES = 'core:service:resources:read'
const CAP_PERMISSIONS = 'core:service:permissions:manage'
const CAP_NOTIFICATIONS = 'core:service:notifications:send'
const CAP_HOOKS = 'core:hooks:define'

const requestTokenByContext = new WeakMap<object, string>()
type TransactionClient = TransactionClientContract

function getContextToken(ctx: object): string {
  const existing = requestTokenByContext.get(ctx)
  if (existing) {
    return existing
  }

  const token = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  requestTokenByContext.set(ctx, token)
  return token
}

function assertFreshContext(pluginId: string, boundContext: PluginHttpContext): void {
  const activeContext = HttpContext.get()
  if (!activeContext) {
    return
  }

  const activeRef = activeContext as unknown as object
  const boundRef = boundContext as unknown as object
  if (activeRef !== boundRef) {
    throw new StaleFacadeUsageError(pluginId, getContextToken(boundRef), getContextToken(activeRef))
  }
}

function getTenantContext(
  ctx: PluginHttpContext
): { tenantId: number; tenantDb: unknown; userId: number | null } | null {
  const tenantId = ctx.tenant?.id
  const tenantDb = ctx.tenantDb
  if (!tenantId || !tenantDb) {
    return null
  }

  return {
    tenantId,
    tenantDb,
    userId: ctx.auth?.user?.id ?? null,
  }
}

function ensureAbilityId(ability: string): void {
  if (ability.includes(':')) {
    throw new Error(
      `Ability "${ability}" is invalid. Ability IDs must use "." separators, not ":".`
    )
  }
}

function ensureNotificationPayload(pluginId: string, payload: NotificationPayload): void {
  if (!payload.type.startsWith(`${pluginId}.`)) {
    throw new Error(`Notification type "${payload.type}" must be prefixed with "${pluginId}."`)
  }
  if (payload.title.length > 200) {
    throw new Error('Notification title exceeds 200 characters')
  }
  if (payload.body && payload.body.length > 1000) {
    throw new Error('Notification body exceeds 1000 characters')
  }
  if (payload.url && !payload.url.startsWith('/')) {
    throw new Error('Notification url must be a relative path starting with "/"')
  }
  if (payload.meta) {
    const size = Buffer.byteLength(JSON.stringify(payload.meta), 'utf8')
    if (size > 4096) {
      throw new Error('Notification meta exceeds 4KB')
    }
  }
}

function createUsersFacade(pluginId: string, boundContext: PluginHttpContext): UsersFacade {
  const toUserDto = (row: {
    id: number
    fullName: string | null
    email: string
    avatarUrl: string | null
  }) => ({
    id: row.id,
    fullName: row.fullName ?? '',
    email: row.email,
    avatarUrl: row.avatarUrl,
  })

  return {
    async findById(userId: number) {
      assertFreshContext(pluginId, boundContext)
      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        return null
      }

      const membership = await TenantMembership.query({
        client: tenantContext.tenantDb as AdonisHttpContext['tenantDb'],
      })
        .where('tenant_id', tenantContext.tenantId)
        .where('user_id', userId)
        .preload('user')
        .first()

      if (!membership?.user) {
        return null
      }

      return toUserDto(membership.user)
    },

    async findByIds(userIds: number[]) {
      assertFreshContext(pluginId, boundContext)
      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext || userIds.length === 0) {
        return []
      }

      const memberships = await TenantMembership.query({
        client: tenantContext.tenantDb as AdonisHttpContext['tenantDb'],
      })
        .where('tenant_id', tenantContext.tenantId)
        .whereIn('user_id', userIds)
        .preload('user')

      return memberships
        .filter((membership) => membership.user)
        .map((membership) => toUserDto(membership.user))
    },

    async search(query: string, limit?: number) {
      assertFreshContext(pluginId, boundContext)
      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        return []
      }

      const trimmed = query.trim()
      if (trimmed.length < 2) {
        return []
      }

      const effectiveLimit = Math.min(Math.max(limit ?? 20, 1), 50)
      const memberships = await TenantMembership.query({
        client: tenantContext.tenantDb as AdonisHttpContext['tenantDb'],
      })
        .where('tenant_id', tenantContext.tenantId)
        .preload('user', (userQuery) => {
          userQuery.where((builder) => {
            builder.whereILike('full_name', `%${trimmed}%`).orWhereILike('email', `%${trimmed}%`)
          })
        })
        .limit(effectiveLimit)

      return memberships
        .filter((membership) => membership.user)
        .map((membership) => toUserDto(membership.user))
    },

    async currentUser() {
      assertFreshContext(pluginId, boundContext)
      const currentUserId = boundContext.auth?.user?.id
      if (!currentUserId) {
        return null
      }
      return this.findById(currentUserId)
    },
  }
}

function createPermissionsFacade(
  pluginId: string,
  boundContext: PluginHttpContext
): PermissionsFacade {
  const namespacePrefix = `${pluginId}.`

  return {
    async check(userId: number, ability: string, resource?: { type: string; id: string | number }) {
      assertFreshContext(pluginId, boundContext)
      ensureAbilityId(ability)

      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        return false
      }

      if (ability.startsWith(namespacePrefix) && resource) {
        const hasExplicitGrant = await pluginPermissionGrantService.hasGrant(
          {
            tenantId: tenantContext.tenantId,
            pluginId,
            userId,
            ability,
            resourceType: resource.type,
            resourceId: resource.id,
          },
          tenantContext.tenantDb as TransactionClient
        )
        if (hasExplicitGrant) {
          return true
        }
      }

      const decision = await authzService.check(
        {
          tenantId: tenantContext.tenantId,
          userId,
          tenantRole: (() => {
            const tenantWithMembership = boundContext.tenant as
              | { membership?: { role?: unknown } }
              | undefined
            return typeof tenantWithMembership?.membership?.role === 'string'
              ? tenantWithMembership.membership.role
              : undefined
          })(),
        },
        {
          ability,
          resource,
        }
      )
      return decision.allow
    },

    async require(
      userId: number,
      ability: string,
      resource?: { type: string; id: string | number }
    ) {
      const allowed = await this.check(userId, ability, resource)
      if (!allowed) {
        throw new Error(`Authorization denied for ability "${ability}"`)
      }
    },

    async grant(input) {
      assertFreshContext(pluginId, boundContext)
      ensureAbilityId(input.ability)

      if (!input.ability.startsWith(namespacePrefix)) {
        throw new Error(`Ability "${input.ability}" must be in namespace "${namespacePrefix}"`)
      }

      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      await pluginPermissionGrantService.upsertGrant(
        {
          tenantId: tenantContext.tenantId,
          pluginId,
          userId: input.userId,
          ability: input.ability,
          resourceType: input.resource.type,
          resourceId: input.resource.id,
          grantedBy: input.grantedBy,
        },
        tenantContext.tenantDb as TransactionClient
      )

      await auditEventEmitter.emit({
        tenantId: tenantContext.tenantId,
        type: AUDIT_EVENT_TYPES.PLUGIN_CUSTOM,
        actor: { type: 'plugin', id: pluginId },
        resource: {
          type: input.resource.type,
          id: input.resource.id,
        },
        meta: {
          event: 'plugin.authz.grant',
          ability: input.ability,
          userId: input.userId,
          grantedBy: input.grantedBy,
        },
      })
    },

    async revoke(input) {
      assertFreshContext(pluginId, boundContext)
      ensureAbilityId(input.ability)

      if (!input.ability.startsWith(namespacePrefix)) {
        throw new Error(`Ability "${input.ability}" must be in namespace "${namespacePrefix}"`)
      }

      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      await pluginPermissionGrantService.revokeGrant(
        {
          tenantId: tenantContext.tenantId,
          pluginId,
          userId: input.userId,
          ability: input.ability,
          resourceType: input.resource.type,
          resourceId: input.resource.id,
        },
        tenantContext.tenantDb as TransactionClient
      )

      await auditEventEmitter.emit({
        tenantId: tenantContext.tenantId,
        type: AUDIT_EVENT_TYPES.PLUGIN_CUSTOM,
        actor: { type: 'plugin', id: pluginId },
        resource: {
          type: input.resource.type,
          id: input.resource.id,
        },
        meta: {
          event: 'plugin.authz.revoke',
          ability: input.ability,
          userId: input.userId,
        },
      })
    },
  }
}

function createBootPermissionsRegistrar(pluginId: string): BootPermissionsRegistrar {
  return {
    registerAbilities(abilities) {
      pluginAbilityRegistry.registerAbilities(pluginId, abilities)
    },
  }
}

function createNotificationsFacade(pluginId: string, boundContext: PluginHttpContext) {
  return {
    async send(notification: NotificationPayload): Promise<void> {
      assertFreshContext(pluginId, boundContext)
      ensureNotificationPayload(pluginId, notification)

      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      const recipientMembership = await TenantMembership.query({
        client: tenantContext.tenantDb as AdonisHttpContext['tenantDb'],
      })
        .where('tenant_id', tenantContext.tenantId)
        .where('user_id', notification.recipientId)
        .first()
      if (!recipientMembership) {
        throw new Error('Notification recipient must be a tenant member')
      }

      await notificationService.send(
        {
          tenantId: tenantContext.tenantId,
          recipientId: notification.recipientId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          meta: notification.meta,
          pluginId,
        },
        tenantContext.tenantDb as TransactionClient
      )

      await auditEventEmitter.emit({
        tenantId: tenantContext.tenantId,
        type: AUDIT_EVENT_TYPES.PLUGIN_CUSTOM,
        actor: { type: 'plugin', id: pluginId },
        resource: { type: 'notification', id: notification.recipientId },
        meta: {
          event: 'plugin.notification.sent',
          notificationType: notification.type,
        },
      })
    },

    async sendBatch(notifications: NotificationPayload[]): Promise<void> {
      assertFreshContext(pluginId, boundContext)

      if (notifications.length > 100) {
        throw new Error('sendBatch accepts at most 100 notifications per call')
      }

      for (const notification of notifications) {
        ensureNotificationPayload(pluginId, notification)
      }

      const tenantContext = getTenantContext(boundContext)
      if (!tenantContext) {
        throw new Error('Tenant context is required')
      }

      const recipientIds = Array.from(new Set(notifications.map((n) => n.recipientId)))
      const memberships = await TenantMembership.query({
        client: tenantContext.tenantDb as AdonisHttpContext['tenantDb'],
      })
        .where('tenant_id', tenantContext.tenantId)
        .whereIn('user_id', recipientIds)
      const allowedRecipients = new Set(memberships.map((membership) => membership.userId))

      for (const recipientId of recipientIds) {
        if (!allowedRecipients.has(recipientId)) {
          throw new Error(`Recipient ${recipientId} is not a tenant member`)
        }
      }

      await notificationService.sendBatch(
        notifications.map((notification) => ({
          tenantId: tenantContext.tenantId,
          recipientId: notification.recipientId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          meta: notification.meta,
          pluginId,
        })),
        tenantContext.tenantDb as TransactionClient
      )

      await auditEventEmitter.emit({
        tenantId: tenantContext.tenantId,
        type: AUDIT_EVENT_TYPES.PLUGIN_CUSTOM,
        actor: { type: 'plugin', id: pluginId },
        meta: {
          event: 'plugin.notification.batch_sent',
          count: notifications.length,
        },
      })
    },
  }
}

function createHooksFacade(
  pluginId: string,
  manifest: PluginManifest,
  boundContext: PluginHttpContext
) {
  const definedHooks = new Set(manifest.definedHooks ?? [])
  const definedFilters = new Set(manifest.definedFilters ?? [])

  return {
    async dispatchAction(hook: string, ...args: unknown[]) {
      assertFreshContext(pluginId, boundContext)

      if (!hook.startsWith(`${pluginId}:`)) {
        throw new Error(`Hook "${hook}" must be namespaced with "${pluginId}:"`)
      }
      if (!definedHooks.has(hook)) {
        throw new Error(`Hook "${hook}" is not declared in manifest.definedHooks`)
      }

      await hookRegistry.dispatchAction(hook, ...args)
    },

    async applyFilters<T>(hook: string, initial: T, ...args: unknown[]): Promise<T> {
      assertFreshContext(pluginId, boundContext)

      if (!hook.startsWith(`${pluginId}:`)) {
        throw new Error(`Hook "${hook}" must be namespaced with "${pluginId}:"`)
      }
      if (!definedFilters.has(hook)) {
        throw new Error(`Hook "${hook}" is not declared in manifest.definedFilters`)
      }

      return hookRegistry.applyFilters(hook, initial, ...args)
    },
  }
}

function createRequestScopedFacades(
  pluginId: string,
  manifest: PluginManifest,
  boundContext: PluginHttpContext,
  deploymentGrantedCapabilities: ReadonlySet<string>
): RequestScopedFacades {
  const tenantContext = getTenantContext(boundContext)
  const requestCapabilities = new Set<string>()
  const grantedByMiddleware = new Set(boundContext.plugin?.grantedCapabilities ?? [])

  if (tenantContext) {
    for (const capability of deploymentGrantedCapabilities) {
      if (grantedByMiddleware.size === 0 || grantedByMiddleware.has(capability)) {
        requestCapabilities.add(capability)
      }
    }
  }

  const users = requestCapabilities.has(CAP_USERS)
    ? createUsersFacade(pluginId, boundContext)
    : null
  const resources = requestCapabilities.has(CAP_RESOURCES)
    ? {
        getRegisteredTypes: () => resourceProviderRegistry.getRegisteredTypes(),
        resolve: async (type: string, id: string | number) => {
          assertFreshContext(pluginId, boundContext)
          const current = getTenantContext(boundContext)
          if (!current) {
            return null
          }

          const resolverContext: ResourceResolverContext = {
            tenantId: current.tenantId,
            userId: current.userId,
            tenantDb: current.tenantDb,
          }
          return resourceProviderRegistry.resolve(type, id, resolverContext)
        },
        exists: async (type: string, id: string | number) => {
          assertFreshContext(pluginId, boundContext)
          const current = getTenantContext(boundContext)
          if (!current) {
            return false
          }

          const resolverContext: ResourceResolverContext = {
            tenantId: current.tenantId,
            userId: current.userId,
            tenantDb: current.tenantDb,
          }
          return resourceProviderRegistry.exists(type, id, resolverContext)
        },
      }
    : null

  const permissions = requestCapabilities.has(CAP_PERMISSIONS)
    ? createPermissionsFacade(pluginId, boundContext)
    : null
  const notifications = requestCapabilities.has(CAP_NOTIFICATIONS)
    ? createNotificationsFacade(pluginId, boundContext)
    : null

  const hooks = requestCapabilities.has(CAP_HOOKS)
    ? createHooksFacade(pluginId, manifest, boundContext)
    : null

  return {
    grantedCapabilities: requestCapabilities,
    hasCapability(capabilityId: string): boolean {
      return requestCapabilities.has(capabilityId)
    },
    users,
    resources,
    permissions,
    notifications,
    hooks,
  }
}

export function createCoreFacadeFactory(input: {
  pluginId: string
  manifest: PluginManifest
  deploymentGrantedCapabilities: ReadonlySet<string>
}): CoreFacadeFactory {
  const hasPermissions = input.deploymentGrantedCapabilities.has(CAP_PERMISSIONS)

  return {
    forRequest(ctx: PluginHttpContext): RequestScopedFacades {
      return createRequestScopedFacades(
        input.pluginId,
        input.manifest,
        ctx,
        input.deploymentGrantedCapabilities
      )
    },
    permissions: hasPermissions ? createBootPermissionsRegistrar(input.pluginId) : null,
    deploymentGrantedCapabilities: input.deploymentGrantedCapabilities,
  }
}
