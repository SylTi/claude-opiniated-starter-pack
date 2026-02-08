/**
 * Server-side plugin contracts.
 *
 * These types are framework-agnostic contracts used by privileged plugins.
 * Runtime implementations are provided by the API host.
 */

import type { PluginManifest } from './manifest.js'
import type { HookListenerRegistry } from './hooks.js'

/**
 * Opaque DB client bound to tenant RLS context by the host runtime.
 */
export type TenantScopedDbClient = unknown

/**
 * Minimal request context shape expected by server plugins.
 * Host runtimes may provide a richer object.
 */
export interface PluginHttpContext {
  tenant?: { id: number }
  auth?: { user?: { id: number } }
  tenantDb?: TenantScopedDbClient
  plugin?: {
    id: string
    grantedCapabilities: string[]
    state?: {
      config?: Record<string, unknown> | null
    }
  }
  request?: unknown
}

export type RouteFeatureOptions = {
  requiredFeatures?: string[]
}

/**
 * Route registration contract exposed to plugins.
 */
export interface RoutesRegistrar {
  get(
    path: string,
    handler: (ctx: PluginHttpContext) => Promise<void> | void,
    options?: RouteFeatureOptions
  ): Promise<void>
  post(
    path: string,
    handler: (ctx: PluginHttpContext) => Promise<void> | void,
    options?: RouteFeatureOptions
  ): Promise<void>
  put(
    path: string,
    handler: (ctx: PluginHttpContext) => Promise<void> | void,
    options?: RouteFeatureOptions
  ): Promise<void>
  patch(
    path: string,
    handler: (ctx: PluginHttpContext) => Promise<void> | void,
    options?: RouteFeatureOptions
  ): Promise<void>
  delete(
    path: string,
    handler: (ctx: PluginHttpContext) => Promise<void> | void,
    options?: RouteFeatureOptions
  ): Promise<void>
}

/**
 * Background job registration contract (implementation-defined).
 */
export interface JobsRegistrar {
  register(name: string, handler: (payload: unknown) => Promise<void> | void): void
}

/**
 * Minimal authz contract exposed to plugins.
 */
export interface AuthzServiceContract {
  check(
    ctx: { tenantId: number; userId: number; tenantRole?: string; extra?: Record<string, unknown> },
    check: { ability: string; resource?: { type: string; id: string | number } }
  ): Promise<{ allow: boolean; reason?: string }>
}

export type UserDTO = {
  id: number
  fullName: string
  email: string
  avatarUrl: string | null
}

export interface UsersFacade {
  findById(userId: number): Promise<UserDTO | null>
  findByIds(userIds: number[]): Promise<UserDTO[]>
  search(query: string, limit?: number): Promise<UserDTO[]>
  currentUser(): Promise<UserDTO | null>
}

export type ResourceTypeDefinition = {
  type: string
  label: string
  icon?: string
  ownerPluginId: string
}

export type ResourceMeta = {
  type: string
  id: string | number
  tenantId: number
  title: string
  url: string
  createdBy?: number
  createdAt?: string
}

export type ResourceResolverContext = {
  tenantId: number
  userId: number | null
  tenantDb: TenantScopedDbClient
}

export interface ResourceProvider {
  types(): ResourceTypeDefinition[]
  resolve(
    type: string,
    id: string | number,
    ctx: ResourceResolverContext
  ): Promise<ResourceMeta | null>
  exists(type: string, id: string | number, ctx: ResourceResolverContext): Promise<boolean>
}

export interface ResourceProviderRegistry {
  register(provider: ResourceProvider): void
  getRegisteredTypes(): ResourceTypeDefinition[]
}

export interface ResourceRegistryFacade {
  getRegisteredTypes(): ResourceTypeDefinition[]
  resolve(type: string, id: string | number): Promise<ResourceMeta | null>
  exists(type: string, id: string | number): Promise<boolean>
}

export type AbilityDefinition = {
  id: string
  description: string
  resourceType?: string
}

export interface BootPermissionsRegistrar {
  registerAbilities(abilities: AbilityDefinition[]): void
}

export interface PermissionsFacade {
  check(
    userId: number,
    ability: string,
    resource?: { type: string; id: string | number }
  ): Promise<boolean>
  require(
    userId: number,
    ability: string,
    resource?: { type: string; id: string | number }
  ): Promise<void>
  grant(input: {
    userId: number
    ability: string
    resource: { type: string; id: string | number }
    grantedBy: number
  }): Promise<void>
  revoke(input: {
    userId: number
    ability: string
    resource: { type: string; id: string | number }
  }): Promise<void>
}

export type NotificationPayload = {
  recipientId: number
  type: string
  title: string
  body?: string
  url?: string
  meta?: Record<string, unknown>
}

export interface NotificationsFacade {
  send(notification: NotificationPayload): Promise<void>
  sendBatch(notifications: NotificationPayload[]): Promise<void>
}

export interface HooksFacade {
  dispatchAction(hook: string, ...args: unknown[]): Promise<void>
  applyFilters<T>(hook: string, initial: T, ...args: unknown[]): Promise<T>
}

export interface RequestScopedFacades {
  grantedCapabilities: ReadonlySet<string>
  hasCapability(capabilityId: string): boolean
  users: UsersFacade | null
  resources: ResourceRegistryFacade | null
  permissions: PermissionsFacade | null
  notifications: NotificationsFacade | null
  hooks: HooksFacade | null
}

export interface CoreFacadeFactory {
  forRequest(ctx: PluginHttpContext): RequestScopedFacades
  permissions: BootPermissionsRegistrar | null
  deploymentGrantedCapabilities: ReadonlySet<string>
}

export interface PluginFeaturePolicyService {
  has(featureId: string, ctx: PluginHttpContext): Promise<boolean>
  require(featureId: string, ctx: PluginHttpContext): Promise<void>
}

/**
 * Plugin server registration context.
 */
export interface ServerPluginContext {
  pluginId: string
  manifest: PluginManifest
  routes: RoutesRegistrar
  hooks: HookListenerRegistry
  authz: AuthzServiceContract
  db: TenantScopedDbClient
  jobs: JobsRegistrar
  featurePolicy: PluginFeaturePolicyService
  core: CoreFacadeFactory | null
}

/**
 * Error thrown when request-scoped facades are reused across requests.
 */
export class StaleFacadeUsageError extends Error {
  readonly code = 'PLUGIN_STALE_FACADE' as const
  readonly pluginId: string
  readonly staleRequestId: string
  readonly activeRequestId: string

  constructor(pluginId: string, staleRequestId: string, activeRequestId: string) {
    super(
      `Plugin "${pluginId}" attempted to use a stale facade from request "${staleRequestId}" ` +
        `while active request is "${activeRequestId}".`
    )
    this.name = 'StaleFacadeUsageError'
    this.pluginId = pluginId
    this.staleRequestId = staleRequestId
    this.activeRequestId = activeRequestId
  }
}
