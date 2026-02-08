# Spec — Tier C Platform Plugins (Privileged Marketplace Plugins with Core Service Access)

**Stack:** Next.js (App Router) + AdonisJS + Postgres (Supabase) + pnpm strict monorepo
**Depends on:** `plugins-system-final.md`, `plugins-mandatory-rules.md`, `main-app-plugin.md`, `marketplace-distribution-spec.md`, `local-rbac-spec.md`, `enterprise-feature-control-plane-spec.md`

---

## Dependency note

Tier C plugins may declare `manifest.dependencies` on other plugins (for example, `collab` depending on `files` for attachments).  
Dependency lifecycle and enforcement rules are defined in `plugin-dependency-enforcement-spec.md`.

---

## 0) Purpose & Context

This spec introduces **Tier C — Platform Plugins**: a new plugin tier for marketplace-distributable plugins that need deeper integration with core than Tier B allows.

### 0.1 The problem

Tier B plugins are self-contained — they own their tables, their routes, their namespace. But some plugin use cases are **cross-cutting** by nature:

- **Collaboration** (comments, shares, mentions) — needs to reference any resource type, query users, extend permissions, send notifications
- **Advanced analytics** — needs to read core entities (users, teams, subscriptions) for aggregation
- **Full-text search** — needs to index core and plugin resources alike
- **Activity feeds** — needs to observe and render events across all resource types
- **Workflow automation** — needs to trigger actions on core entities based on rules

These features require controlled access to core services — something Tier B's isolation boundaries intentionally prevent.

### 0.2 What changes

| Before this spec | After this spec |
|---|---|
| Tier C = "Enterprise/infra features, core-owned, NOT plugins" | Tier C = **Platform Plugins** (marketplace, privileged, core facade access) |
| Enterprise features = Tier C | Enterprise features = **core-owned modules** (unchanged, just drop the "Tier C" label) |

### 0.3 What does NOT change

- **Enterprise features** (SSO, KMS, audit sinks, DLP, RBAC extensions) remain **core-owned code**, not plugins, not marketplace items. They ship with the enterprise license and use the existing dynamic import pattern.
- **Enterprise Providers** (Type 1 contracts: `KeyProvider`, `AuditSink`, `SSOProvider`, `RbacRulePack`) remain core-owned.
- **Tier A and Tier B** are unchanged.
- All existing mandatory rules (RLS, tenancy, capabilities) still apply, **with one amendment**: for Tier C `core:*` capabilities, the fail-closed behavior is relaxed to `null` facades (see section 6.2 and the `plugins-mandatory-rules.md` amendment in section 11.2).

### 0.4 Business model alignment

```
OSS Core (public branch — free)
  └── Marketplace OSS
        Tier A — UI plugins (free / low price)
        Tier B — App plugins (free / mid price)
        Tier C — Platform plugins (mid / premium price)

Enterprise Core (private branch — $10-15k/year)
  └── Enterprise features (SSO, KMS, audit, DLP, RBAC extensions)
  └── Marketplace Enterprise
        Tier B/C plugins with "requiresEnterprise": true
        (plugins that build on top of enterprise features)
```

### 0.5 Rollout synchronization

This document defines the **target Tier C architecture**. The companion documents listed in section 11 are baseline/pre-Tier-C today and must be amended **in the same rollout PR**.

Until those companion amendments are merged, treat this document as authoritative for Tier C behavior, and treat conflicting Tier C statements in baseline docs as transitional.

---

## 1) Tier C definition

### 1.1 What Tier C plugins are

Tier C plugins are **moderately-to-highly privileged marketplace plugins** that receive controlled access to core services through **read-only (or controlled-write) facades**.

They are real plugins:
- Statically installed via loader maps (same as Tier A/B)
- Enabled/disabled per tenant (same as Tier A/B)
- Distributed via marketplace (same as Tier B)
- Fail-closed on denied capabilities, with the Tier C `core:*` exception (`null` facades; see section 6.2)

They are more privileged than Tier B:
- Can **read core entities** (users, teams, resources) through service facades
- Can **extend core RBAC** with new abilities (through the existing `AuthzService`)
- Can **send notifications** through a core notification facade
- Can **reference core tables via FK** (users, tenants) — not just their own namespace
- Can **define new hooks** that other plugins (Tier A/B/C) can listen to
- Can **register resource providers** that the main app plugin configures

They still cannot:
- Access raw core internals (`router`, `bouncer`, `drive`, unscoped DB clients)
- Bypass tenant isolation or RLS
- Modify core authentication/session issuance
- Override core routes
- Access enterprise features directly (unless `requiresEnterprise: true` and enterprise is active)

### 1.2 Tier comparison (updated)

| Capability | Tier A | Tier B | Tier C |
|---|---|---|---|
| UI filters/slots/theme/i18n | Yes | Yes | Yes |
| Own API routes (namespaced) | No | Yes | Yes |
| Own DB tables (`plugin_{id}_*`) | No | Yes | Yes |
| Own background jobs | No | Yes | Yes |
| Own RBAC namespace | No | Yes | Yes |
| Listen to hooks | Yes | Yes | Yes |
| FK to core tables (users, tenants) | No | No | **Yes** |
| Core service facades (read) | No | No | **Yes** |
| Core service facades (controlled write) | No | No | **Yes** (notifications, permissions) |
| Define new hooks | No | No | **Yes** |
| Register resource providers | No | No | **Yes** |
| Raw DB/router/bouncer/drive access | No | No | No |
| Bypass RLS/tenancy | No | No | No |

### 1.3 Manifest declaration

```json
{
  "pluginId": "collab",
  "packageName": "@saas-premium/collab",
  "version": "1.0.0",
  "tier": "C",
  "access": "premium",
  "displayName": "Collaboration Suite",
  "description": "Comments, shares, mentions for any resource type",
  "requestedCapabilities": [
    { "capability": "app:routes", "reason": "Serve collaboration API endpoints" },
    { "capability": "app:db:read", "reason": "Plugin-owned tables for comments, shares" },
    { "capability": "app:db:write", "reason": "Create/update comments, shares, mentions" },
    { "capability": "app:authz", "reason": "Sharing permissions for resources" },
    { "capability": "core:service:users:read", "reason": "Resolve user mentions, display names" },
    { "capability": "core:service:resources:read", "reason": "Validate referenced resources exist" },
    { "capability": "core:service:permissions:manage", "reason": "Register sharing abilities" },
    { "capability": "core:service:notifications:send", "reason": "Notify on mentions and comments" },
    { "capability": "core:hooks:define", "reason": "Emit collab:* hooks declared in definedHooks/definedFilters" },
    { "capability": "core:entity:fk:users", "reason": "FK to users table for author references" }
  ],
  "migrations": { "dir": "./database/migrations", "schemaVersion": 1 },
  "hooks": [
    { "hook": "resource:commented", "handler": "onResourceCommented", "priority": 50 },
    { "hook": "resource:shared", "handler": "onResourceShared", "priority": 50 }
  ],
  "definedHooks": [
    "collab:comment.created",
    "collab:comment.deleted",
    "collab:share.created",
    "collab:share.revoked",
    "collab:mention.resolved"
  ],
  "definedFilters": [
    "collab:resource.types",
    "collab:comment.render",
    "collab:mention.autocomplete"
  ],
  "features": {
    "comments": { "defaultEnabled": true },
    "shares": { "defaultEnabled": true },
    "mentions": { "defaultEnabled": true },
    "threads": { "defaultEnabled": true }
  }
}
```

New manifest fields for Tier C:
- `"tier": "C"` — declares platform plugin tier
- `"definedHooks"` — action hooks this plugin emits (other plugins can listen)
- `"definedFilters"` — filter hooks this plugin emits (other plugins can modify). This list is flat and may include both server-dispatched and client-dispatched filter names.
- `"features"` — optional plugin feature declarations used by core feature-policy enforcement (per-tenant + main-app hard-disable overlays).
- `"requestedCapabilities"` — includes existing app capabilities (`app:*`) plus Tier C core capabilities introduced by this spec (`core:service:*`, `core:hooks:define`, `core:entity:fk:users`)

Terminology note: in this spec, "manifest" refers to the plugin package metadata file (`plugin.meta.json`).

Manifest declaration is intentionally transport-agnostic:
- `definedHooks` / `definedFilters` are validated only for namespace and declaration.
- Whether a hook/filter runs on server or client is determined by where it is dispatched/applied at runtime, not by a separate manifest field.

### 1.4 Naming conventions

All identifiers follow a consistent two-part convention:

| Identifier type | Separator | Format | Example |
|---|---|---|---|
| **Hook names** (actions/filters) | colon `:` | `{pluginId}:{event.name}` | `collab:comment.created` |
| **Capability IDs (existing platform)** | colon `:` | existing canonical IDs | `app:routes`, `app:db:read`, `app:authz` |
| **Capability IDs (Tier C additions)** | colon `:` | `core:{domain}:{resource}:{action}` and related IDs | `core:service:users:read`, `core:hooks:define` |
| **Ability names** (RBAC) | dot `.` | `{pluginId}.{resource}.{action}` | `collab.share.write` |
| **Notification types** | dot `.` | `{pluginId}.{event}` | `collab.mention` |
| **Table names** | underscore `_` | `plugin_{pluginId}_{entity}` | `plugin_collab_comments` |
| **Route paths** | slash `/` | `/api/v1/apps/{pluginId}/...` | `/api/v1/apps/collab/comments` |

Rationale:
- **Hooks use colon** as the top-level separator (consistent with existing core hooks: `auth:registered`, `team:created`, `ui:nav:main`). Sub-levels within the event name use dots.
- **Capabilities use colon IDs only** (`app:*`, `core:*`).
- **Abilities use dot IDs only** (`{pluginId}.{resource}.{action}`).

`Capability` vs `Ability` (must not be mixed):
- `Capability` = plugin-to-platform permission, granted at plugin boot/runtime boundary.
  Example: `core:service:resources:read` allows the plugin to receive the resources facade.
- `Ability` = user-to-resource action permission, enforced per request via RBAC/authz.
  Example: `collab.comment.write` determines whether a user can write a comment.
- Capability checks decide what the plugin code can access.
- Ability checks decide what the current user can do through that plugin.

Quick Do / Don't examples:

| Type | Do | Don't |
|---|---|---|
| Capability ID | `app:routes`, `core:service:users:read` | `app.routes`, `core.service.users.read` |
| Ability ID | `collab.comment.write`, `notes.note.read` | `collab:comment:write`, `notes:note:read` |
| Hook name | `collab:comment.created`, `auth:registered` | `collab.comment.created`, `auth.registered` |

Review rule (Tier C core IDs): if a capability starts with `core:` and contains `.`, reject it. If an identifier is parsed as an ability and contains `:`, reject it.

### 1.5 `authzNamespace` derivation

For Tier C plugins, `authzNamespace` is **always derived** as `{pluginId}.` (not configurable). This prevents divergence between the plugin ID and its ability namespace.

For Tier B plugins, `authzNamespace` remains configurable (backward compatible).

### 1.6 Enterprise dependency flag

Tier C plugins that require enterprise core features must declare it:

```json
{
  "requiresEnterprise": true,
  "requiredEnterpriseFeatures": ["audit_export_sinks"]
}
```

At boot, if `requiresEnterprise: true` and the enterprise feature is not available (OSS deployment), the plugin is **quarantined** with a clear error message. The app continues.

---

## 2) Core Service Facades

Tier C plugins receive controlled access to core functionality through **service facades**.

### 2.1 Lifecycle model (per-request, not per-boot)

Facades are **request-scoped**. The plugin receives a **factory** at boot time that creates facade instances bound to the current `HttpContext` for each request.

```
Boot time:
  Plugin receives → CoreFacadeFactory (stateless, creates request-bound facades)

Request time:
  Route handler calls → factory.forRequest(ctx) → CoreServiceFacades (bound to this request's tenant/user/admin context)
```

This ensures:
- Every facade call operates in the correct tenant context (no stale state)
- RLS is enforced through the request's transaction for tenant-scoped facade operations
- Audit logs capture the correct request/user/tenant
- No shared mutable state between requests

### 2.2 Design principles

1. **Facades, not raw core access** — Plugins never touch core models or unscoped core DB/framework internals. Plugin-owned table operations may use the tenant-scoped request DB client.
2. **Request-scoped** — Every facade instance is bound to a specific `HttpContext`. Tenant/user/admin context is always current.
3. **Audited** — Every facade call is logged (structured log, optional audit record for write operations).
4. **Rate-limited** — Facade calls have per-plugin-per-tenant rate limits to prevent noisy-neighbor abuse.
5. **Read-heavy, write-controlled** — Most facades are read-only. Write operations are limited to specific, well-defined actions (send notification, register ability).
6. **Granular** — Each facade is independently grantable via its own capability. A plugin only gets the facades it requested and was approved for.
7. **No direct cross-plugin facade calls** — Tier C plugins do not invoke other plugins' facades directly. Cross-plugin integration uses hooks/events.

### 2.3 Facade contracts

#### 2.3.1 UsersFacade (read-only)

**Requires capability:** `core:service:users:read`

Provides access to user data within the current request's tenant context.

```ts
export type UserDTO = {
  id: number
  fullName: string
  email: string
  avatarUrl: string | null
}

export interface UsersFacade {
  /**
   * Find a user by ID within the current tenant.
   * Returns null if user doesn't exist or isn't a member of the tenant.
   */
  findById(userId: number): Promise<UserDTO | null>

  /**
   * Find multiple users by IDs within the current tenant.
   * Returns only users that exist and are members of the tenant.
   */
  findByIds(userIds: number[]): Promise<UserDTO[]>

  /**
   * Search users by name/email within the current tenant.
   * Results are limited to tenant members only.
   * @param query - Search string (matched against name and email)
   *               Minimum length 2 to reduce enumeration abuse.
   * @param limit - Maximum results (capped at 50)
   */
  search(query: string, limit?: number): Promise<UserDTO[]>

  /**
   * Get the current authenticated user for this request.
   */
  currentUser(): Promise<UserDTO | null>
}
```

**Security:**
- All queries are tenant-scoped (RLS enforced via the request's transaction).
- `UserDTO` is a facade DTO (projection), not raw core user model shape. It returns only non-sensitive fields: `id`, `fullName`, `email`, `avatarUrl`.
- `search()` is rate-limited per plugin-per-tenant (default: 100 calls/minute).
- `search()` rejects queries shorter than 2 characters and may apply additional anti-enumeration controls at the facade layer.

#### 2.3.2 ResourceRegistryFacade (read-only)

**Requires capability:** `core:service:resources:read`

Provides a uniform way to reference and resolve resources across the platform.

```ts
export type ResourceTypeDefinition = {
  type: string              // e.g. 'note', 'board', 'task'
  label: string             // Human-readable label
  icon?: string             // Icon identifier
  ownerPluginId: string     // Which plugin owns this resource type
}

export type ResourceMeta = {
  type: string
  id: string | number
  tenantId: number
  title: string             // Display title
  url: string               // Relative URL to the resource
  createdBy?: number        // User ID of creator
  createdAt?: string        // ISO timestamp
}

export interface ResourceRegistryFacade {
  /**
   * Get all registered resource types.
   * Resource types are registered by the main app plugin and other Tier B/C plugins.
   */
  getRegisteredTypes(): ResourceTypeDefinition[]

  /**
   * Resolve a specific resource by type and ID.
   * Returns null if the resource doesn't exist or isn't accessible in the current tenant.
   * The resolution is delegated to the owning plugin's resource resolver.
   * The resolver runs within the current request's tenant-scoped transaction (RLS enforced).
   */
  resolve(type: string, id: string | number): Promise<ResourceMeta | null>

  /**
   * Check if a resource exists and is accessible in the current tenant.
   * Lighter than resolve() — no metadata fetching.
   */
  exists(type: string, id: string | number): Promise<boolean>
}
```

**Security:**
- Resource resolution is tenant-scoped via the request's RLS transaction.
- The facade delegates to the owning plugin's registered resolver (see section 3).
- `ResourceTypeDefinition` does not expose internal table names (removed from the public interface).

#### 2.3.3 Permissions — two distinct interfaces

Permissions use **two interfaces** for two distinct lifecycles:

**`BootPermissionsRegistrar`** — boot-time-only, not request-scoped. Used once during plugin setup.
**`PermissionsFacade`** — request-scoped. Returned by `forRequest(ctx)`.

**Requires capability:** `core:service:permissions:manage`

##### BootPermissionsRegistrar (boot-time only)

```ts
export interface BootPermissionsRegistrar {
  /**
   * Register additional abilities for this plugin's namespace.
   * Abilities are namespaced: "collab.share.read", "collab.share.write", etc.
   * This extends the existing AuthzService.registerNamespace() pattern.
   *
   * Called once during plugin setup (boot-time). Not available per-request.
   * Must be idempotent (upsert semantics) so repeated boot/restart does not duplicate abilities.
   *
   * Failure behavior:
   * - Throws PluginBootError if any ability ID is outside the plugin namespace.
   * - Throws validation error for malformed AbilityDefinition entries.
   * - Duplicate registrations are upsert/no-op (idempotent), not errors.
   * - Boot service treats thrown errors here as plugin-scoped boot failures (quarantine).
   */
  registerAbilities(abilities: AbilityDefinition[]): void
}

export type AbilityDefinition = {
  id: string              // e.g. "collab.share.read"
  description: string
  resourceType?: string   // If scoped to a specific resource type
}
```

##### PermissionsFacade (request-scoped)

```ts
export interface PermissionsFacade {
  /**
   * Check if a user has a specific ability.
   * Delegates to the core AuthzService.
   * Read-only: may check any namespace (core or plugin).
   */
  check(userId: number, ability: string, resource?: { type: string; id: string | number }): Promise<boolean>

  /**
   * Require a specific ability (throws 403 if denied).
   * Delegates to the core AuthzService.
   * Read-only: may require any namespace (core or plugin).
   */
  require(userId: number, ability: string, resource?: { type: string; id: string | number }): Promise<void>

  /**
   * Grant a user an ability for a specific resource (scoped grant).
   * This is a controlled write: only the plugin's own namespace is writable.
   * Used for resource-level sharing (e.g., "user X can view resource Y").
   */
  grant(input: {
    userId: number
    ability: string
    resource: { type: string; id: string | number }
    grantedBy: number
  }): Promise<void>

  /**
   * Revoke a previously granted ability.
   */
  revoke(input: {
    userId: number
    ability: string
    resource: { type: string; id: string | number }
  }): Promise<void>
}
```

**Security:**
- `BootPermissionsRegistrar.registerAbilities()` only accepts abilities prefixed with `{pluginId}.` (derived namespace).
- `BootPermissionsRegistrar.registerAbilities()` is idempotent (duplicate registration on restart is a no-op/update, not a boot failure).
- `PermissionsFacade.check()` and `require()` can read any namespace; this is intentional for cross-plugin/core authorization decisions.
- `PermissionsFacade` runtime validation rejects ability strings containing `:` (capability IDs are invalid ability inputs).
- `PermissionsFacade.grant()` and `revoke()` only work for the plugin's own namespace.
- All changes are audited (`audit:record` with `type: "authz.grant"` / `"authz.revoke"`).
- Tenant-scoped: grants only apply within the current request's tenant.

#### 2.3.4 NotificationsFacade (controlled write)

**Requires capability:** `core:service:notifications:send`

**Prerequisite:** Core must provide a notification service. If core does not have a notification service, the `notifications` facade is `null`. Plugins that need notifications should guard for `null` and degrade gracefully (see section 6.2).

This makes the dependency explicit and non-blocking for the rest of Tier C.

```ts
export type NotificationPayload = {
  recipientId: number       // User ID
  type: string              // Namespaced: "collab.mention", "collab.comment"
  title: string             // Short title (max 200 chars)
  body?: string             // Optional body (max 1000 chars)
  url?: string              // Relative URL to navigate to
  meta?: Record<string, unknown>  // Plugin-specific metadata (max 4KB)
}

export interface NotificationsFacade {
  /**
   * Send a notification to a user.
   * Notification type must be prefixed with the plugin's namespace.
   * Delivery channel (in-app, email, push) is controlled by core + user preferences.
   */
  send(notification: NotificationPayload): Promise<void>

  /**
   * Send notifications to multiple users.
   * @param notifications - Array of notifications (max 100 per call)
   */
  sendBatch(notifications: NotificationPayload[]): Promise<void>
}
```

**Security:**
- `type` must be prefixed with `{pluginId}.` (e.g., `"collab.mention"`).
- `recipientId` must be a member of the current tenant (facade validates via the request's tenant context).
- `meta` size is validated by the facade (JSON-serialized payload must be <= 4KB; else validation error).
- Notification rendering must be treated as untrusted input by core UI layers (escape/sanitize before display).
- Rate-limited per plugin-per-tenant (default: 500 notifications/minute).
- Delivery channel is core-controlled. Plugins cannot force email or push.

#### 2.3.5 HooksFacade (controlled write)

**Requires capability:** `core:hooks:define`

Allows Tier C plugins to emit their own custom hooks that other plugins can listen to.

**Relationship to `HookRegistry`:** Plugin-facing `ServerPluginContext.hooks` is a **listener-only** interface (`HookListenerRegistry`) that supports registration but does not expose dispatch methods. `HooksFacade` is the namespace-enforced interface for **dispatching** plugin-defined hooks. Tier C plugins must use `HooksFacade` to emit their custom hooks — the facade validates that the hook name is declared in the manifest and prefixed with `{pluginId}:`.

The full `HookRegistry` (with `dispatchAction/applyFilters`) remains a core-internal surface. Plugin code should not access dispatch via type-casts or non-standard imports; such bypass attempts are rejected during marketplace review and CI policy checks.

Backward-compatibility note: plugin-facing dispatch on `ServerPluginContext.hooks` is no longer supported. Legacy internal plugins that dispatched via `ctx.hooks.dispatchAction(...)` must migrate to `forRequest(ctx).hooks?.dispatchAction(...)` through `HooksFacade` (with `core:hooks:define`) or move dispatch to core-owned code if the hook is not plugin-defined.

Scope note: `HooksFacade` is request-scoped (`forRequest(ctx)`). The migration path above applies to request handlers. For boot-time/background contexts, plugin-facing dispatch is intentionally unavailable; dispatch must use core-owned code paths.

```ts
export interface HooksFacade {
  /**
   * Dispatch a custom action hook defined by this plugin.
   * Hook name must be declared in the plugin's "definedHooks" manifest field.
   * Validates {pluginId}: prefix before delegating to core HookRegistry.
   */
  dispatchAction(hook: string, ...args: any[]): Promise<void>

  /**
   * Apply a custom filter hook defined by this plugin.
   * Filter name must be declared in the plugin's "definedFilters" manifest field.
   * Validates {pluginId}: prefix before delegating to core HookRegistry.
   */
  applyFilters<T>(hook: string, initial: T, ...args: any[]): Promise<T>
}
```

**Security:**
- Plugins can only dispatch hooks declared in their `definedHooks` / `definedFilters` manifest fields.
- Attempting to dispatch an undeclared hook is a runtime error (logged, not fatal).
- Other plugins can register listeners for these hooks using `HookListenerRegistry`.
- Marketplace review/CI must reject plugin code that attempts to bypass listener-only hooks and dispatch directly.
- This listener-only split is required before any community plugin onboarding.

### 2.4 Facade injection (factory pattern)

At boot time, the plugin receives a `CoreFacadeFactory`. At request time, it creates facades bound to the current `HttpContext`.

Request handler DB contract:
- `HttpContext` used in plugin route handlers must expose a request-scoped tenant DB client (`tenantDb: TenantScopedDbClient`).
- This is the canonical DB path for plugin-owned table queries inside handlers. Do not rely on boot-time context objects for per-request writes.

```ts
export interface ServerPluginContext {
  // Existing (Tier A/B)
  pluginId: string
  hooks: HookListenerRegistry
  routes: RoutesRegistrar
  authz: AuthzService
  db: TenantScopedDbClient // tenant-scoped DB for plugin-owned tables only
  jobs: JobsRegistrar
  featurePolicy: PluginFeaturePolicyService

  // New (Tier C only — null for Tier A/B)
  core: CoreFacadeFactory | null
}

/**
 * Factory for creating request-scoped facade instances.
 * Injected at boot time for Tier C plugins that have at least one granted
 * runtime core capability (`core:service:*` or `core:hooks:define`).
 * If no runtime core capability is granted (including "only core:entity:fk:users"),
 * the plugin receives core = null (same as Tier B).
 */
export interface CoreFacadeFactory {
  /**
   * Create request-bound facades for the given HttpContext.
   * Returns only the facades whose capabilities are granted for this request context.
   * Must be called inside a route handler (not at boot time).
   */
  forRequest(ctx: HttpContext): RequestScopedFacades

  /**
   * Boot-time-only: register abilities for this plugin's namespace.
   * Null if core:service:permissions:manage capability is not granted.
   * This is a separate interface from the request-scoped PermissionsFacade.
   * Invariant: when `deploymentGrantedCapabilities` contains
   * `core:service:permissions:manage`, this field is non-null.
   */
  permissions: BootPermissionsRegistrar | null

  /**
   * Boot-time introspection: which runtime core capabilities passed deployment-level checks.
   * This includes static capability approval + core prerequisite checks, but excludes
   * request-time entitlement decisions (tenant/user/admin context).
   * Example: if notifications service is unavailable, `core:service:notifications:send`
   * is omitted and `forRequest(ctx).notifications` is null even if requested.
   *
   * Allows plugins to check at boot whether critical deployment prerequisites are available,
   * and throw to trigger quarantine if they cannot function in this deployment.
   *
   * Example: if (!core.deploymentGrantedCapabilities.has('core:service:resources:read')) {
   *   throw new Error('Collab plugin requires resource access')
   * }
   */
  deploymentGrantedCapabilities: ReadonlySet<string>
}

/**
 * Request-scoped facades. Fields are non-null only if the corresponding
 * capability is granted for this request context.
 */
export interface RequestScopedFacades {
  /**
   * Effective runtime core capabilities for this request context.
   * This includes request-time entitlements/role checks.
   */
  grantedCapabilities: ReadonlySet<string>

  /**
   * Convenience helper equivalent to `grantedCapabilities.has(capabilityId)`.
   */
  hasCapability(capabilityId: string): boolean

  users: UsersFacade | null
  resources: ResourceRegistryFacade | null
  permissions: PermissionsFacade | null
  notifications: NotificationsFacade | null
  hooks: HooksFacade | null
}

/**
 * Plugin-facing hook interface: listener registration only.
 * Dispatch is intentionally excluded; plugins must use HooksFacade.
 */
export interface ServerActionHooks {}
export interface ServerFilterHooks {}
export interface ClientFilterHooks {}

export interface HookListenerRegistry {
  registerAction<H extends keyof ServerActionHooks & string>(
    hook: H,
    cb: (...args: ServerActionHooks[H] extends unknown[] ? ServerActionHooks[H] : unknown[]) => void | Promise<void>,
    priority?: number
  ): () => void
  registerAction(
    hook: string,
    cb: (...args: unknown[]) => void | Promise<void>,
    priority?: number
  ): () => void

  registerFilter<H extends keyof ServerFilterHooks & string>(
    hook: H,
    cb: (...args: ServerFilterHooks[H] extends unknown[] ? ServerFilterHooks[H] : unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
  registerFilter(
    hook: string,
    cb: (...args: unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
}

export interface ClientHookListenerRegistry {
  registerFilter<H extends keyof ClientFilterHooks & string>(
    hook: H,
    cb: (...args: ClientFilterHooks[H] extends unknown[] ? ClientFilterHooks[H] : unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
  registerFilter(
    hook: string,
    cb: (...args: unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
}
```

**Granular capability mapping:**

| Capability | Boot-time | Request-time facade field |
|---|---|---|
| `core:service:users:read` | — | `users` |
| `core:service:resources:read` | — | `resources` |
| `core:service:permissions:manage` | `factory.permissions` (BootPermissionsRegistrar) | `permissions` |
| `core:service:notifications:send` | — | `notifications` (also requires core notification service) |
| `core:hooks:define` | — | `hooks` |

Request-time facade fields are available only when both conditions hold:
- deployment scope allows the capability, and
- current request scope (tenant/user/admin entitlements) allows it.

If a runtime capability is not granted for a given request context, the corresponding facade field is `null`. Deployment-level denials prevent that capability from appearing in any request. The plugin can request only the facades it needs (least privilege). This replaces the previous all-or-nothing model.

Invariant (deployment scope):
- `deploymentGrantedCapabilities.has('core:service:permissions:manage')` implies `core.permissions` is non-null.

Invariant (runtime facade capabilities):
- `facades.grantedCapabilities.has(capabilityId)` guarantees the corresponding request facade field is non-null for that request.
- If a request facade field is non-null, the matching capability ID is present in `facades.grantedCapabilities`.
- This invariant applies to runtime facade capabilities only (`core:service:*`, `core:hooks:define`).
- `core:entity:fk:users` is schema-only and intentionally excluded from runtime facade invariants.

Background job rule:
- `CoreFacadeFactory.forRequest(ctx)` is request-only. Background jobs do not receive `HttpContext`, so jobs cannot use Tier C facades directly.
- If a plugin needs core-side actions from a job, it must route through a core-owned workflow or an authenticated request path that provides `HttpContext`.

### 2.5 Core feature policy gates (non-bypassable)

Feature gating is a **core abstraction**, not per-plugin custom code.

Why:
- Multiple plugins need feature toggles.
- Main app and platform policy must be enforceable centrally.
- Direct API calls must not bypass disabled features.

Policy model (effective feature policy):
1. Plugin declares available features in manifest (`features` map).
2. Core applies main-app/platform hard-disable policy (cannot be overridden by tenant/plugin code).
3. Core applies tenant plugin config (`plugin_states.config`) for tenant-level feature toggles.
4. Effective feature policy is resolved per request and used by route middleware and runtime checks.

Route enforcement:
- `RoutesRegistrar` accepts per-route feature requirements.
- Core attaches middleware ahead of plugin handlers.
- If a required feature is disabled, request is rejected with HTTP `403`.

```ts
export type RouteFeatureOptions = {
  requiredFeatures?: string[]
}

export interface RoutesRegistrar {
  get(path: string, handler: (ctx: HttpContext) => Promise<void> | void, options?: RouteFeatureOptions): Promise<void>
  post(path: string, handler: (ctx: HttpContext) => Promise<void> | void, options?: RouteFeatureOptions): Promise<void>
  put(path: string, handler: (ctx: HttpContext) => Promise<void> | void, options?: RouteFeatureOptions): Promise<void>
  patch(path: string, handler: (ctx: HttpContext) => Promise<void> | void, options?: RouteFeatureOptions): Promise<void>
  delete(path: string, handler: (ctx: HttpContext) => Promise<void> | void, options?: RouteFeatureOptions): Promise<void>
}

export interface PluginFeaturePolicyService {
  has(featureId: string, ctx: HttpContext): Promise<boolean>
  require(featureId: string, ctx: HttpContext): Promise<void> // throws 403
}
```

Error contract:
- HTTP `403`
- `{ error: 'E_FEATURE_DISABLED', message: 'Feature <id> is disabled for this tenant' }`

Security rule:
- UI hiding is not sufficient.
- Server-side enforcement is mandatory.
- Any feature-restricted behavior must be guarded by core feature policy checks in routes/services.

---

## 3) Resource Registry (cross-cutting resource resolution)

### 3.1 The problem

Tier C plugins (like collaboration) need to reference resources they don't own. A comment is attached to a "note" or a "board" — but the collab plugin doesn't own the notes or boards table.

V1 scope decision:
- Resource registry exposes `resolve` + `exists` only.
- List/search style operations are out of scope for v1 and should be added later via a versioned facade extension if required.

### 3.2 Resource providers

Any plugin (Tier B or C) or the main app plugin can register **resource providers** that describe the resources they own:

```ts
export type ResourceResolverContext = {
  tenantId: number // Logging/audit context only; provider queries must use tenantDb (RLS-scoped)
  userId: number | null
  tenantDb: TenantScopedDbClient
}

export interface ResourceProvider {
  /**
   * Resource types this provider handles.
   */
  types(): ResourceTypeDefinition[]

  /**
   * Resolve a resource by type and ID.
   * Must return null if the resource doesn't exist or isn't in the current tenant.
   *
   * IMPORTANT: Core passes a request-scoped resolver context that includes
   * the active tenant-scoped transaction (`tenantDb`). Providers MUST use
   * this transaction (directly or via model query client binding) so RLS
   * and tenant/user session variables are applied consistently. Do not use
   * manual tenant filtering as a substitute for this transaction context.
   * Consumers (Tier C plugins) never call resolvers directly — they go through
   * the ResourceRegistryFacade.
   */
  resolve(type: string, id: string | number, ctx: ResourceResolverContext): Promise<ResourceMeta | null>

  /**
   * Check if a resource exists (lightweight).
   */
  exists(type: string, id: string | number, ctx: ResourceResolverContext): Promise<boolean>
}
```

### 3.3 Registration

Resource providers are registered during boot via a dedicated hook:

```ts
// Core emits during boot
'app:resources.register' (payload: { registry: ResourceProviderRegistry })

// Main app plugin registers its resource types
hooks.registerAction('app:resources.register', async ({ registry }) => {
  registry.register({
    types: () => [
      { type: 'note', label: 'Note', icon: 'file-text', ownerPluginId: 'main-app' },
      { type: 'board', label: 'Board', icon: 'layout', ownerPluginId: 'main-app' },
    ],
    // The provider owns these tables and queries them directly.
    // The resolver context carries the request transaction (`resolverCtx.tenantDb`)
    // so all reads stay inside the caller's RLS-scoped execution context.
    resolve: async (type, id, resolverCtx) => {
      if (type === 'note') {
        const note = await Note.query({ client: resolverCtx.tenantDb }).where('id', id).first()
        if (!note) return null
        return {
          type: 'note',
          id: note.id,
          tenantId: note.tenantId,
          title: note.title,
          url: `/notes/${note.id}`,
          createdBy: note.createdBy,
          createdAt: note.createdAt.toISO(),
        }
      }
      return null
    },
    exists: async (type, id, resolverCtx) => {
      if (type === 'note') {
        return !!(await Note.query({ client: resolverCtx.tenantDb }).where('id', id).first())
      }
      return false
    },
  })
})
```

### 3.4 Resolution flow

When a Tier C plugin calls `facades.resources.resolve('note', 42)`:

1. `ResourceRegistryFacade` looks up the provider that registered `type: 'note'`
2. Builds `ResourceResolverContext` from the current `HttpContext` (`tenantId`, `userId`, `tenantDb`)
3. Delegates to that provider's `resolve(..., resolverCtx)` method inside the caller's transaction
4. Provider queries its own table using `resolverCtx.tenantDb` (RLS enforced)
5. Returns `ResourceMeta` or `null`

The Tier C plugin never touches the `notes` table directly.

### 3.5 Collision rules

- Each resource type must have exactly one provider.
- If two plugins try to register the same `type`, it is a **boot-fatal error** (same semantics as nav ID collisions).
- Resource types are globally unique strings. Convention: `{pluginId}.{entity}` for plugin-owned, `{entity}` for main-app-owned.

---

## 4) FK-to-core rules

### 4.1 Allowed foreign keys

Tier C plugin tables may reference these core tables via FK:

| Core table | FK column | Allowed for |
|---|---|---|
| `tenants` | `tenant_id` | All tiers (mandatory) |
| `users` | `author_id`, `created_by`, etc. | Tier C only |

### 4.2 FK rules

- FK to `users` must use `ON DELETE SET NULL` (user deletion must not cascade-delete plugin data).
- FK to `tenants` must use `ON DELETE RESTRICT` (standard, unchanged).
- Tier C plugins **must not** FK to any other core table. If they need to reference other entities (e.g., subscriptions, teams), they must use the resource registry facade.
- FK to other plugin tables is **not allowed** (plugins are isolated from each other).
- Enforcement is not review-only: migration/static CI checks must reject Tier C migrations that create FKs from `plugin_{pluginId}_*` tables to disallowed core tables.
- Plugin domain logic must handle nullable user references created by `ON DELETE SET NULL` (for example, render "Deleted user" or clean up rows in plugin-owned jobs/workflows).

### 4.3 Migration example (Tier C)

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class PluginCollabComments extends BaseSchema {
  protected tableName = 'plugin_collab_comments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('tenant_id')
        .notNullable()
        .defaultTo(this.schema.raw("current_setting('app.tenant_id')::integer"))
        .references('id')
        .inTable('tenants')
        .onDelete('RESTRICT')

      // Tier C: FK to core users table (allowed)
      table.integer('author_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      // Polymorphic resource reference (resolved via ResourceRegistryFacade)
      table.string('resource_type', 100).notNullable()
      table.string('resource_id', 100).notNullable()

      table.text('body').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['tenant_id', 'resource_type', 'resource_id', 'created_at'])
      table.index(['tenant_id', 'author_id'])
    })

    await this.db.rawQuery(`select app.apply_tenant_rls(?::regclass)`, [this.tableName])
    await this.db.rawQuery(`select app.assert_tenant_scoped_table(?::regclass)`, [this.tableName])
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

---

## 5) Plugin-defined hooks (Tier C only)

### 5.1 Why

Tier C plugins introduce platform capabilities that other plugins may want to integrate with. A collaboration plugin emitting `collab:comment.created` allows:
- A Tier A plugin to show a notification badge
- A Tier B analytics plugin to track engagement metrics
- Another Tier C plugin to index comments for search

### 5.2 Rules

1. **Declared in manifest** — Only hooks listed in `definedHooks` / `definedFilters` can be dispatched.
2. **Namespaced** — Hook names must use the format `{pluginId}:{event.name}` (colon separator between plugin ID and event, dots within the event name). Consistent with core hooks (`auth:registered`, `team:created`, `ui:nav:main`).
3. **Typed** — Plugin must export type augmentations for its hooks (same pattern as existing hook typing).  
   Use `ServerActionHooks` / `ServerFilterHooks` for server runtime hooks and `ClientFilterHooks` for browser runtime filters.
4. **Discoverable** — The marketplace listing auto-generates baseline hook/filter docs from `definedHooks`/`definedFilters`; plugin-provided docs remain required for payload semantics and usage guidance.

### 5.3 Hook registration timing (late-binding)

**Listeners can register for any hook name at any time**, even before the defining Tier C plugin boots. The hook registry does **not** validate hook existence at listener registration time.

Validation only applies to **dispatching**:
- Only declared hooks can be dispatched (enforced by `HooksFacade`).
- If a Tier C plugin is not installed or quarantined, its hooks simply never fire. Registered listeners are harmless no-ops.

This avoids boot ordering issues where a Tier A/B plugin registers a listener before the Tier C plugin that defines the hook has booted.

### 5.4 Type augmentation example

```ts
// @saas-premium/collab/src/types.d.ts
import '@saas/plugins-core'

declare module '@saas/plugins-core' {
  interface ServerActionHooks {
    'collab:comment.created': [payload: {
      commentId: number
      resourceType: string
      resourceId: string | number
      authorId: number
      tenantId: number
    }]
    'collab:comment.deleted': [payload: {
      commentId: number
      resourceType: string
      resourceId: string | number
      tenantId: number
    }]
    'collab:share.created': [payload: {
      shareId: number
      resourceType: string
      resourceId: string | number
      sharedWithUserId: number
      permissionLevel: 'view' | 'comment' | 'edit'
      tenantId: number
    }]
    'collab:share.revoked': [payload: {
      shareId: number
      resourceType: string
      resourceId: string | number
      tenantId: number
    }]
    'collab:mention.resolved': [payload: {
      mentionedUserId: number
      commentId: number
      resourceType: string
      resourceId: string | number
      tenantId: number
    }]
  }

  // Include only server-dispatched filters here.
  interface ServerFilterHooks {}

  interface ClientFilterHooks {
    'collab:resource.types': [types: ResourceTypeConfig[]]
    'collab:comment.render': [renderer: CommentRenderer]
    'collab:mention.autocomplete': [config: MentionAutocompleteConfig]
  }
}
```

### 5.5 Listening to Tier C hooks

Other plugins listen to Tier C hooks the same way they listen to core hooks:

```ts
// A Tier A plugin listening to collab hooks
hooks.registerAction('collab:comment.created', async (payload) => {
  // Update badge count, etc.
})
```

If the Tier C plugin is not installed or is quarantined, the hook simply never fires. Listeners are no-ops.

### 5.6 Cross-repo hook typing

Runtime hook wiring does not require compile-time type augmentation packages.

- If the listener plugin has a direct dependency on the hook-defining package, it may use typed augmentation from that package.
- If the hook-defining plugin lives in a different repo/package boundary (no direct dependency), listeners should register using plain string hook names and local payload runtime validation.
- Marketplace review must reject hard dependencies from bundled/main-repo plugins to marketplace plugin runtime packages only for type augmentation.

This keeps cross-repo integration decoupled while preserving optional type safety where dependency boundaries allow it.

Example (cross-repo, no direct dependency on collab package):

```ts
hooks.registerAction('collab:comment.created', async (payload: unknown) => {
  const parsed = parseCollabCommentCreated(payload) // local runtime schema validation
  if (!parsed) return
  // ...safe handling
})
```

---

## 6) Tier C Capabilities

### 6.1 New capabilities (Tier C only)

| Capability | Description | Facade access |
|---|---|---|
| `core:service:users:read` | Read user data (search, find) | `UsersFacade` |
| `core:service:resources:read` | Resolve resources, check existence | `ResourceRegistryFacade` |
| `core:service:permissions:manage` | Register abilities, check/grant/revoke | `BootPermissionsRegistrar` + `PermissionsFacade` |
| `core:service:notifications:send` | Send in-app notifications | `NotificationsFacade` |
| `core:hooks:define` | Emit custom hooks for other plugins | `HooksFacade` |
| `core:entity:fk:users` | FK references to core users table | Migration/review-time capability (no runtime facade) |

These `core:*` capabilities are **new in this spec** and must be added to the capability registry, tier validation, and capability grant pipeline before Tier C rollout.

Existing app/plugin capabilities remain canonical colon IDs (`app:routes`, `app:db:read`, `app:db:write`, `app:authz`, `app:jobs`).

Capability scope matrix (Tier C runtime capabilities):

| Capability | Deployment scope check | Request scope check | Tenant context required |
|---|---|---|---|
| `core:service:users:read` | Yes | Yes | Yes |
| `core:service:resources:read` | Yes | Yes | Yes |
| `core:service:permissions:manage` | Yes | Yes | Yes |
| `core:service:notifications:send` | Yes (includes notification service prerequisite) | Yes | Yes |
| `core:hooks:define` | Yes | Yes | Usually yes (unless hook payload contract explicitly documents global-admin context) |
| `core:entity:fk:users` | Yes (review/migration gate only) | No | N/A |

### 6.2 Capability grant rules — granular model

Each `core:*` capability is **independently grantable**. A plugin requests only the facades it needs, and receives only the facades it was approved for.

Capability evaluation happens in two scopes:
- **Deployment scope (boot time):** static approvals/prerequisites that determine whether the factory can expose a capability at all (`deploymentGrantedCapabilities`).
- **Request scope (runtime):** tenant/user/admin entitlements for the current `HttpContext`, reflected in `facades.grantedCapabilities`.

Context rule:
- Tenant-scoped facades require a valid tenant context in the request. If tenant context is absent, tenant-scoped facade capabilities evaluate to denied for that request (`null` facade / denied operation), unless a facade explicitly documents global-admin behavior.

`core:entity:fk:users` is a schema capability, not a runtime facade capability. It is validated at manifest/review time to gate migration approval.

**The single runtime model (facade capabilities): denied capability = `null` facade.** Plugins must guard nullable facades. The system does NOT quarantine for denied runtime capabilities — the plugin boots and runs with reduced functionality.

Quarantine only occurs for **`requiresEnterprise: true` when enterprise is absent**, or when **the plugin itself throws** during boot (self-reported inability to function).

| Scenario | Result | Plugin boots? |
|---|---|---|
| Plugin requests `core:service:users:read` + `core:service:resources:read`, both granted | Gets `users` + `resources` facades, others are `null` | Yes |
| Plugin requests `core:service:users:read`, admin denies it | `users` is `null` | Yes (reduced functionality) |
| Plugin requests `core:service:notifications:send` but core has no notification service | `notifications` is `null` | Yes (reduced functionality) |
| Deployment approves `core:service:resources:read`, but current tenant/user is not entitled in this request | `resources` is `null` for this request | Yes |
| Plugin requests only `core:entity:fk:users` and it is approved | Runtime facades are unavailable (`core: null`) | Yes |
| Plugin requests `core:entity:fk:users`, review denies it | Migration is rejected (cannot create FK) | No (manifest/review rejection) |
| Plugin requests `requiresEnterprise: true` but enterprise is absent | — | **No** (quarantined) |
| Plugin requests no `core:*` capabilities | Gets `core: null` (same as Tier B) | Yes |

**Plugin author responsibility:** If a facade is critical to the plugin's operation:
- Check `deploymentGrantedCapabilities` at boot for deployment-level prerequisites and throw to quarantine if impossible in this deployment.
- Check request-level capabilities (`facades.grantedCapabilities` / `facades.hasCapability`) in handlers before assuming a facade is available for the current tenant/user/admin context.

```ts
// At boot time — check deployment prerequisites
export default async function CollabServer(ctx: ServerPluginContext): Promise<void> {
  const { core } = ctx
  if (!core) {
    throw new Error('Collab plugin requires Tier C core facades')
  }

  // Deployment-scope introspection: check before registering routes
  if (!core.deploymentGrantedCapabilities.has('core:service:resources:read')) {
    throw new Error('Collab plugin requires core:service:resources:read')
  }
  if (!core.deploymentGrantedCapabilities.has('core:service:permissions:manage')) {
    throw new Error('Collab plugin requires core:service:permissions:manage')
  }
  // ... register routes only after confirming critical facades are available
}
```

Note: `deploymentGrantedCapabilities` is available at boot time (no `HttpContext` needed). Request-level checks still apply in route handlers.

There is no all-or-nothing rule. Least privilege is enforced: request only what you need, get only what you're approved for.

### 6.3 Failure semantics (three distinct phases)

To avoid ambiguity, failure behavior is defined per phase:

| Phase | When | Failure type | Behavior | Example |
|---|---|---|---|---|
| **Manifest validation** | CI / `pnpm install` / marketplace review | **Rejection** | Manifest is invalid, cannot be published or installed | Tier A plugin declares `core:service:users:read` |
| **Boot — plugin-scoped** | Server startup, per-plugin | **Quarantine** | Plugin disabled, app continues normally | `requiresEnterprise` but enterprise absent, plugin throws during boot |
| **Boot — structural** | Server startup, cross-plugin | **Boot-fatal** | App refuses to start | Resource type collision, nav ID collision |

Rules:
- Manifest validation rejects **structurally invalid** manifests (wrong tier + capability combo, invalid hook names). This happens before deployment — no boot-time duplication.
- **Capability denial does NOT quarantine.** Deployment-level denials keep facades unavailable globally; request-level denials produce `null` facades for that request. Missing core services also produce `null` facades. Plugins boot with reduced functionality.
- Quarantine handles two cases: (1) `requiresEnterprise: true` but enterprise is absent, and (2) plugin throws during boot (self-reports inability to function). The plugin is marked inactive; the app is healthy.
- Boot-fatal handles **structural conflicts** that would make the app's behavior nondeterministic (two plugins claiming the same resource type). These are rare and indicate a misconfiguration.

### 6.4 Rate limits (per capability)

| Facade | Default rate limit | Configurable |
|---|---|---|
| `UsersFacade.search()` | 100/min per plugin per tenant | Yes (admin) |
| `UsersFacade.findById()` | 1000/min per plugin per tenant | Yes |
| `ResourceRegistryFacade.resolve()` | 500/min per plugin per tenant | Yes |
| `NotificationsFacade.send()` | 500/min per plugin per tenant | Yes |
| `NotificationsFacade.sendBatch()` | 50/min per plugin per tenant | Yes |
| `PermissionsFacade.grant()` | 200/min per plugin per tenant | Yes |

Rate limits are enforced by the facade layer with key `(pluginId, scopeKey, facadeOperation)`, where `scopeKey` is tenant ID for tenant-scoped requests and a reserved global-admin key for explicitly non-tenant admin contexts. Exceeding limits returns a structured error (not a crash).

### 6.5 Capability denial error contract

When a required runtime capability is unavailable for the current request context, facades (or explicit plugin guard paths) must return:
- HTTP `403`
- Error payload:
  - `{ error: 'E_CAPABILITY_DENIED', message: 'Capability <id> is not granted for this request context' }`

Use `403` (authorization/entitlement denial), not `503` (service outage), for capability-scope denials.

---

## 7) Boot pipeline changes

### 7.1 Updated boot sequence

```
1.  Load plugin manifests                           (existing)
2.  Validate manifest fields                        (existing)
    ── NEW additions to manifest validation (step 2) ──
    For each plugin with tier: "C":
      a. Validate requested capabilities against the capability registry
         (existing `app:*` canonical IDs + Tier C `core:*` additions from this spec)
         NOTE: `core:entity:fk:users` is validated here as a migration/review gate only
         (it does not produce a runtime facade field).
      b. Validate definedHooks/definedFilters prefixed with "{pluginId}:"
      c. If definedHooks or definedFilters are non-empty, require core:hooks:define
         in requestedCapabilities (reject manifest otherwise)
      d. Reject Tier A/B manifests that request core:* capabilities
    NOTE: These are structural manifest checks, NOT boot-time checks.
    Invalid manifests are rejected at CI / pnpm install / marketplace review.
3.  License entitlement check                       (existing — marketplace spec)
4.  ── NEW: Enterprise dependency check ──
    For each plugin with requiresEnterprise: true:
      Check enterprise features are available on this deployment
      If absent → quarantine (plugin-scoped failure)
5.  Check capabilities + admin approvals            (existing)
    For Tier C: evaluate deployment-level capability approvals/prerequisites
    independently for each runtime core capability
    Deployment-denied runtime capability → corresponding facade remains unavailable
    `core:entity:fk:users` is review-time only (does not participate in runtime facade mapping)
    Plugin boots with reduced functionality (not quarantined)
6.  ── NEW: Create CoreFacadeFactory ──
    For each Tier C plugin:
      If at least one runtime core capability passes deployment-level checks
      (`core:service:*` or `core:hooks:define`):
        a. Create factory with deployment-granted capability set
        b. Inject into ServerPluginContext.core
      If no runtime core capability is granted
      (including "only core:entity:fk:users" approved):
        a. Set ServerPluginContext.core = null (same as Tier B)
7.  Register hooks                                  (existing)
    NOTE: Listeners for Tier C-defined hooks are accepted (late-binding).
    No validation of hook existence at registration time.
8.  ── NEW: Boot-time facade operations ──
    Tier C plugins call core.permissions.registerAbilities() (boot-time only)
    only when `core?.permissions` is available
    NOTE: This registration targets the existing authz namespace/ability registry.
    It does not depend on step 10 resolver wiring.
9.  ── NEW: Register resource providers ──
    Emit 'app:resources.register'
    Collect all resource type definitions
    Validate no type collisions (boot-fatal if collision)
10. Register authz resolvers                        (existing)
11. ── NEW: Log plugin-defined hooks ──
    For each Tier C plugin with definedHooks/definedFilters:
      a. Log registered hooks for discoverability
      (Hook name format already validated at manifest time — step 2b.
       No collision check needed — namespace prefix guarantees uniqueness.)
12. Validate full nav pipeline                      (existing)
13. Mark active                                     (existing)
14. Emit boot events                                (existing)
```

### 7.2 Boot-fatal conditions (new)

In addition to existing boot-fatal conditions:
- **Resource type collision**: Two providers register the same resource type → boot-fatal (structural).

Removed from boot-fatal (compared to v1 of this spec):
- ~~Hook name collision~~: Not needed — namespace prefix (`{pluginId}:`) structurally prevents cross-plugin collisions. Validated at manifest level instead.
- ~~Tier mismatch~~: Tier A/B requesting `core:*` capabilities is caught at manifest validation (CI/install), not boot. No duplication at boot.
- ~~Capability denial~~: Denied capabilities produce `null` facades, not quarantine. Plugin boots with reduced functionality (see section 6.2).

---

## 8) Marketplace review tiers

### 8.1 Review requirements by tier

| Tier | Review level | Automated checks | Manual review |
|---|---|---|---|
| A | Standard | Manifest validation, no server code | Light review |
| B | Standard | Manifest + RLS audit + namespace check | Code review |
| C | **Enhanced** | All Tier B checks + facade usage audit | **Security audit** |

### 8.2 Tier C enhanced review checklist

In addition to the standard plugin review checklist (from `plugins-mandatory-rules.md` section 12):

- [ ] `tier: "C"` is justified (plugin genuinely needs core access, not just convenience)
- [ ] Each `core:*` capability is necessary and minimal (least privilege)
- [ ] Facade usage is proportional (not bulk-dumping user data)
- [ ] `UsersFacade.search()` is not used to enumerate all users
- [ ] `PermissionsFacade.grant()` grants are scoped (not blanket grants)
- [ ] `NotificationsFacade` is not used for spam-like patterns
- [ ] Deployment prerequisites checked at boot via `deploymentGrantedCapabilities` (throws if missing)
- [ ] Request handlers check `facades.grantedCapabilities` / `facades.hasCapability` before assuming non-null required facades
- [ ] Optional facades guarded with `if (facades.xxx)` for graceful degradation
- [ ] Plugin does not bypass listener-only hooks to dispatch directly (must use `HooksFacade`)
- [ ] Plugin-defined hooks have clear, documented contracts
- [ ] FK references use `ON DELETE SET NULL` for user references
- [ ] No attempt to access core tables directly (bypassing facades)
- [ ] Rate limit thresholds are acceptable for the plugin's use case
- [ ] `forRequest(ctx)` is called in every route handler (not cached across requests)

---

## 9) Security rules (Tier C specific)

### 9.1 Facade isolation

- Facades are created **per-plugin, per-request** via `CoreFacadeFactory.forRequest(ctx)`.
- Each facade instance is bound to:
  - The plugin's ID (for audit and rate limiting)
  - The current `HttpContext` (for tenant/user/admin context)
- Facades enforce tenant context — there is no cross-tenant escape hatch.
- Caching a `RequestScopedFacades` instance across requests is forbidden.
- Enforcement mechanism: each facade captures a `requestId`/context token at `forRequest(ctx)` creation time. Every facade method verifies the active request token before executing. Mismatch throws `StaleFacadeUsageError`, logs a warning with `pluginId` + request IDs, and rejects the call.

```ts
export class StaleFacadeUsageError extends Error {
  readonly code = 'PLUGIN_STALE_FACADE'
  readonly pluginId: string
  readonly staleRequestId: string
  readonly activeRequestId: string
}
```

Handling contract:
- This error is raised by the facade layer (plugin misuse), not by business logic.
- The framework should treat it as a server error, return HTTP 500 for that request, and log `pluginId`, stale request ID, and active request ID.
- Plugin code should not catch and suppress this error.
- `StaleFacadeUsageError` should be exported from `@saas/plugins-core` so plugin and core code can type it consistently.

### 9.2 Data minimization

- `UsersFacade` returns `UserDTO` (non-sensitive fields only). Plugins cannot access passwords, MFA config, session tokens, or email verification status.
- `ResourceRegistryFacade` returns `ResourceMeta` (display metadata only). Plugins cannot access raw resource data or internal table names.
- `PermissionsFacade` can only modify the plugin's own namespace.

### 9.3 Audit trail

All Tier C facade calls that perform write operations generate audit records:

| Operation | Audit type |
|---|---|
| `permissions.grant()` | `plugin.authz.grant` |
| `permissions.revoke()` | `plugin.authz.revoke` |
| `notifications.send()` | `plugin.notification.sent` |
| `notifications.sendBatch()` | `plugin.notification.batch_sent` |
| `HooksFacade.dispatchAction()` | `plugin.hook.dispatched` |
| `HooksFacade.applyFilters()` | `plugin.hook.filter_applied` |

Read operations are logged at `debug` level (structured log, not audit record).

### 9.4 Namespace enforcement

All Tier C plugin outputs must be namespaced. For Tier C, `authzNamespace` is always `{pluginId}.` (derived, not configurable):

| Output type | Format | Example |
|---|---|---|
| Hook names | `{pluginId}:{event.name}` | `collab:comment.created` |
| Ability names | `{pluginId}.{resource}.{action}` | `collab.share.write` |
| Notification types | `{pluginId}.{event}` | `collab.mention` |
| Table names | `plugin_{pluginId}_{entity}` | `plugin_collab_comments` |
| Route paths | `/api/v1/apps/{pluginId}/*` | `/api/v1/apps/collab/comments` |

Attempting to use a name outside the plugin's namespace is a runtime error.

---

## 10) Collaboration plugin example (Tier C)

This section demonstrates a complete Tier C plugin to validate the spec.

### 10.1 Tables

```
plugin_collab_comments
  id, tenant_id, author_id (FK users), resource_type, resource_id,
  body, parent_id (self-ref for threads), created_at, updated_at

plugin_collab_shares
  id, tenant_id, resource_type, resource_id,
  shared_with_user_id (FK users), permission_level,
  created_by (FK users), created_at, expires_at

plugin_collab_mentions
  id, tenant_id, comment_id (FK plugin_collab_comments),
  mentioned_user_id (FK users), resolved, created_at
```

Collab v1 feature scope:
- Included: comments, shares, mentions, threads (feature-gated).
- Deferred: attachments (out of scope for v1; can be added later via `files` dependency).

### 10.2 API routes

```
POST   /api/v1/apps/collab/comments           → Create comment (requires: comments)
GET    /api/v1/apps/collab/comments           → List comments for resource (requires: comments)
DELETE /api/v1/apps/collab/comments/:id       → Delete comment (requires: comments)

POST   /api/v1/apps/collab/shares             → Share resource (requires: shares)
GET    /api/v1/apps/collab/shares             → List shares for resource (requires: shares)
DELETE /api/v1/apps/collab/shares/:id         → Revoke share (requires: shares)

GET    /api/v1/apps/collab/mentions           → List unresolved mentions for user (requires: mentions)
POST   /api/v1/apps/collab/mentions/:id/read  → Mark mention as read (requires: mentions)
```

Feature-gate contract:
- Disabled feature access returns HTTP `403` with `E_FEATURE_DISABLED`.
- This is server-enforced by core route middleware and cannot be bypassed via direct API calls.

### 10.3 Server entrypoint (simplified)

```ts
import type { ServerPluginContext, HttpContext } from '@saas/plugins-core'

export default async function CollabServer(ctx: ServerPluginContext): Promise<void> {
  const { routes, core, featurePolicy } = ctx

  if (!core) {
    throw new Error('Collab plugin requires Tier C core facades')
  }

  // Boot-time: check deployment prerequisites before registering anything
  if (!core.deploymentGrantedCapabilities.has('core:service:resources:read')) {
    throw new Error('Collab plugin requires core:service:resources:read')
  }
  if (!core.deploymentGrantedCapabilities.has('core:service:permissions:manage')) {
    throw new Error('Collab plugin requires core:service:permissions:manage')
  }

  // Boot-time: register abilities (not request-scoped)
  if (!core.permissions) {
    throw new Error('Collab plugin requires core:service:permissions:manage registrar')
  }
  core.permissions.registerAbilities([
    { id: 'collab.share.read', description: 'View shared resources' },
    { id: 'collab.share.write', description: 'Share resources with others' },
    { id: 'collab.comment.read', description: 'View comments' },
    { id: 'collab.comment.write', description: 'Create and delete comments' },
  ])

  // Request-time: route handlers create facades per-request
  routes.post('/comments', async (reqCtx: HttpContext) => {
    // Create request-scoped facades from the factory
    const facades = core.forRequest(reqCtx)
    if (!facades.hasCapability('core:service:resources:read') || !facades.resources) {
      return reqCtx.response.forbidden({
        error: 'E_CAPABILITY_DENIED',
        message: 'Capability core:service:resources:read is not granted for this request context',
      })
    }
    if (!facades.hasCapability('core:service:permissions:manage') || !facades.permissions) {
      return reqCtx.response.forbidden({
        error: 'E_CAPABILITY_DENIED',
        message: 'Capability core:service:permissions:manage is not granted for this request context',
      })
    }

    const { resource_type, resource_id, body, parent_id } = reqCtx.request.only([
      'resource_type', 'resource_id', 'body', 'parent_id',
    ])

    // Threaded comments are optional and core-enforced via feature policy.
    if (parent_id && !(await featurePolicy.has('threads', reqCtx))) {
      return reqCtx.response.forbidden({
        error: 'E_FEATURE_DISABLED',
        message: 'Feature threads is disabled for this tenant',
      })
    }

    // Validate resource exists via facade (not direct table access)
    const resource = await facades.resources.resolve(resource_type, resource_id)
    if (!resource) {
      return reqCtx.response.notFound({
        error: 'ResourceNotFound',
        message: `Resource ${resource_type}/${resource_id} not found`,
      })
    }

    // Check permission via request-scoped facade
    await facades.permissions.require(
      reqCtx.auth.user!.id,
      'collab.comment.write',
      { type: resource_type, id: resource_id }
    )

    // Create comment in plugin's own table (request-scoped DB, RLS enforced)
    // reqCtx.tenantDb is the request-scoped tenant DB client exposed to handlers.
    const [comment] = await reqCtx.tenantDb
      .from('plugin_collab_comments')
      .insert({
        tenant_id: reqCtx.tenant.id,
        author_id: reqCtx.auth.user!.id,
        resource_type,
        resource_id,
        body,
        parent_id: parent_id ?? null,
      })
      .returning('*')
    if (!comment) {
      throw new Error('Failed to create comment')
    }

    // Parse mentions; mentions feature is hard-enforced server-side.
    const mentionedUserIds = parseMentions(body)
    if (mentionedUserIds.length > 0 && !(await featurePolicy.has('mentions', reqCtx))) {
      return reqCtx.response.forbidden({
        error: 'E_FEATURE_DISABLED',
        message: 'Feature mentions is disabled for this tenant',
      })
    }
    if (mentionedUserIds.length > 0 && facades.notifications && facades.users) {
      const users = await facades.users.findByIds(mentionedUserIds)
      const notifications = users.map((user) => ({
        recipientId: user.id,
        type: 'collab.mention',
        title: `${reqCtx.auth.user!.fullName} mentioned you`,
        body: `In a comment on ${resource.title}`,
        url: resource.url,
      }))
      await facades.notifications.sendBatch(notifications)
    }

    // Emit hook for other plugins (graceful degradation if hooks unavailable)
    if (facades.hooks) {
      await facades.hooks.dispatchAction('collab:comment.created', {
        commentId: comment.id,
        resourceType: resource_type,
        resourceId: resource_id,
        authorId: reqCtx.auth.user!.id,
        tenantId: reqCtx.tenant.id,
      })
    }

    return reqCtx.response.created({ data: comment })
  }, { requiredFeatures: ['comments'] })

  routes.get('/mentions', async (reqCtx: HttpContext) => {
    // handler omitted
  }, { requiredFeatures: ['mentions'] })
}
```

### 10.4 Main app plugin integration

The main app plugin registers its resource types and customizes the collab UI:

```ts
// Main app plugin — server entrypoint
// The main app plugin owns the notes/boards tables, so it uses its own models
// to resolve resources. The resolver runs in the request's tenant-scoped transaction.
hooks.registerAction('app:resources.register', async ({ registry }) => {
  registry.register({
    types: () => [
      { type: 'note', label: 'Note', icon: 'file-text', ownerPluginId: 'main-app' },
      { type: 'board', label: 'Board', icon: 'layout', ownerPluginId: 'main-app' },
    ],
    resolve: async (type, id, resolverCtx) => {
      // Provider uses its own models (it owns these tables).
      // RLS is enforced by binding reads to resolverCtx.tenantDb.
      if (type === 'note') {
        const note = await Note.query({ client: resolverCtx.tenantDb }).where('id', id).first()
        if (!note) return null
        return {
          type: 'note',
          id: note.id,
          tenantId: note.tenantId,
          title: note.title,
          url: `/notes/${note.id}`,
          createdBy: note.createdBy,
          createdAt: note.createdAt.toISO(),
        }
      }
      return null
    },
    exists: async (type, id, resolverCtx) => {
      if (type === 'note') {
        return !!(await Note.query({ client: resolverCtx.tenantDb }).where('id', id).first())
      }
      return false
    },
  })
})

// Main app plugin — client entrypoint
// `hooks` is client-side (`ClientHookListenerRegistry`), so only filter registration is available.
hooks.registerFilter('collab:resource.types', (types) => [
  ...types,
  { type: 'note', label: 'Note', icon: 'file-text', shareable: true, commentable: true },
  { type: 'board', label: 'Board', icon: 'layout', shareable: true, commentable: true },
])
```

---

## 11) Spec amendments to existing documents

Rollout note: the following amendments are required for Tier C rollout and should be merged atomically with this spec. If these files still show pre-Tier-C text, that state is transitional.

### 11.1 `plugins-system-final.md` section 1

Replace:

```
### Tier C — Enterprise/infra features
Tier C is **core code** (not plugins).
Extensibility happens only via **Type 1 — Enterprise Providers** (contracts implemented by internal packages).
```

With:

```
### Tier C — Platform plugins (privileged, marketplace)
Tier C plugins are **marketplace-distributable plugins with controlled core service access**.
They receive request-scoped, read-only (or controlled-write) facades for core services (users, resources, permissions, notifications).
See `tier-c-platform-plugins-spec.md` for the complete specification.

### Enterprise features (core-owned, NOT plugins)
Enterprise/infra features (SSO, KMS, audit sinks, DLP, RBAC extensions) remain **core code**.
Extensibility happens only via **Type 1 — Enterprise Providers** (contracts implemented by internal packages).
```

### 11.2 `plugins-mandatory-rules.md`

Add to section 0 (Vocabulary):

```
- **Tier C**: Platform plugin (marketplace, privileged). Core service facades access.
  Same mandatory rules as Tier B, plus additional facade security rules.
```

Amend section 1.2 (Capabilities are mandatory):

```
- If a capability is missing/denied, plugin boot **MUST fail closed** (plugin disabled)
  without crashing the app.
  **Exception for Tier C `core:*` capabilities:** denied `core:*` capabilities produce
  `null` facades. The plugin boots with reduced functionality. This allows graceful
  degradation — e.g., a collaboration plugin can function without notifications.
  Non-`core:*` capabilities (`app:routes`, `app:db:read`, etc.) remain
  fail-closed for all tiers.
```

Add to section 1.3 (No open context):

```
- Tier C plugins access core data **only** through request-scoped facades created via
  CoreFacadeFactory.forRequest(ctx). Facades are tenant-scoped, rate-limited, and audited.
  Direct core table access is forbidden.
- Tier C plugins receive listener-only hooks in `ServerPluginContext` (no dispatch methods).
  Plugin-defined hook dispatch must go through HooksFacade (manifest + namespace validation).
  Any bypass attempt (type-cast/import trick) is a review/CI rejection.
```

### 11.3 `plugins-doc.md`

Update the scope note in section 0.1:

```
> Scope note: Tier C "Platform Plugins" are covered in `tier-c-platform-plugins-spec.md`.
> Enterprise Providers are core-owned and not covered here beyond constraints that Tier A/B/C must respect.
```

### 11.4 `marketplace-distribution-spec.md`

Add to section 1.1 (Three access tiers) a note:

```
Note: The plugin tier (A/B/C) and the access tier (bundled/marketplace/premium) are orthogonal.
A Tier C plugin can be "marketplace" (free with subscription) or "premium" (per-plugin entitlement).
```

Add to section 8.3 (CI validation) Tier C checks:

```
- Reject Tier A/B manifests requesting `core:*` capabilities.
- Require `core:hooks:define` when `definedHooks` or `definedFilters` are non-empty.
- Validate `definedHooks` / `definedFilters` namespace (`{pluginId}:*`).
- Reject explicit `authzNamespace` in Tier C manifests (derived automatically).
- Flag plugin code that bypasses listener-only hooks and calls dispatch APIs directly.
```

### 11.5 `plugins-system-final.md` section 6

Rename section header:

```
## 6) Enterprise Providers (Type 1 — tightly controlled contracts)
```

Add clarifying note:

```
Enterprise Providers are core-owned (NOT marketplace plugins). They implement core contracts
for enterprise infrastructure features. See `enterprise-feature-control-plane-spec.md` for
the control plane that governs these features.

This is distinct from Tier C Platform Plugins, which are marketplace-distributable plugins
with facade access to core services. See `tier-c-platform-plugins-spec.md`.
```

### 11.6 `plugins-system-final.md` section 3 (Hook registry contracts)

Replace the plugin-facing contract shape (not just usage notes):

```
export interface ServerActionHooks {}
export interface ServerFilterHooks {}
export interface ClientFilterHooks {}

export interface HookListenerRegistry {
  registerAction<H extends keyof ServerActionHooks & string>(...)
  registerAction(hook: string, ...)
  registerFilter<H extends keyof ServerFilterHooks & string>(...)
  registerFilter(hook: string, ...)
}

export interface ClientHookListenerRegistry {
  registerFilter<H extends keyof ClientFilterHooks & string>(...)
  registerFilter(hook: string, ...)
}

// Core-internal only (not exposed on plugin-facing context)
export interface HookRegistryInternal extends HookListenerRegistry {
  dispatchAction(...)
  applyFilters(...)
}

// Plugin-facing context
ServerPluginContext.hooks: HookListenerRegistry
```

And explicitly document:

```
- `dispatchAction/applyFilters` are core-internal and must not be available on
  plugin-facing `ServerPluginContext.hooks`.
- Browser-facing plugin hooks expose client filter registration only
  (`ClientHookListenerRegistry`).
- Tier C plugin-defined hook emission must go through `HooksFacade`, which enforces:
  - capability gate (`core:hooks:define`)
  - manifest declaration (`definedHooks` / `definedFilters`)
  - namespace validation (`{pluginId}:*`)
```

---

## 12) Implementation checklist

### Phase 1: Core facades
- [ ] Define facade interfaces in `@saas/plugins-core`
- [ ] Implement `CoreFacadeFactory` (request-scoped factory pattern)
- [ ] Implement `UsersFacade` (wraps existing user queries with DTO projection)
- [ ] Enforce `UsersFacade.search()` anti-enumeration guards (minimum query length + capped results)
- [ ] Implement `ResourceRegistryFacade` (provider pattern + delegation)
- [ ] Define `ResourceResolverContext` and pass request-scoped `tenantDb` into provider callbacks
- [ ] Implement `BootPermissionsRegistrar` (boot-time ability registration)
- [ ] Implement idempotent `registerAbilities()` semantics (upsert/no-duplicate on restart)
- [ ] Implement `PermissionsFacade` (request-scoped, extends existing `AuthzService`)
- [ ] Implement `NotificationsFacade` (wraps core notification service — `null` if service doesn't exist)
- [ ] Implement `HookListenerRegistry` as plugin-facing hook type (no dispatch methods)
- [ ] Implement `ClientHookListenerRegistry` for browser-side filter registration
- [ ] Implement `HooksFacade` (wraps existing `HookRegistry` with namespace validation)
- [ ] Add rate limiting layer to all facades
- [ ] Unit tests: facade isolation (tenant context, namespace enforcement, rate limiting)
- [ ] Unit tests: factory creates request-bound instances, rejects stale contexts
- [ ] Unit tests: null facade when capability denied (no quarantine)
- [ ] Unit tests: capability denial returns standardized 403 `E_CAPABILITY_DENIED`
- [ ] Unit tests: stale facade reuse across requests throws `StaleFacadeUsageError`
- [ ] Unit tests: `registerAbilities()` is idempotent across repeated boots
- [ ] Integration tests: facade calls within tenant-scoped transactions (RLS enforced)

### Phase 2: Boot pipeline
- [ ] Update `PluginBootService` to handle `tier: "C"` validation
- [ ] Implement granular capability → facade mapping
- [ ] Inject `CoreFacadeFactory` into `ServerPluginContext` for Tier C plugins
- [ ] Add `app:resources.register` hook emission during boot
- [ ] Add resource type collision detection (boot-fatal)
- [ ] Add plugin-defined hook namespace validation (manifest-level)
- [ ] Add `requiresEnterprise` check at boot
- [ ] Implement late-binding hook listener registration (no existence validation)
- [ ] Add migration/static CI guard: reject Tier C plugin FKs to disallowed core tables
- [ ] Unit tests: boot with Tier C plugin (granted, denied, partial capabilities)
- [ ] Unit tests: resource type collision → boot-fatal
- [ ] Unit tests: quarantine on requiresEnterprise missing
- [ ] Integration tests: full boot sequence with Tier A + B + C plugins

### Phase 3: Core feature policy (non-bypassable)
- [ ] Add manifest `features` schema (feature IDs + default enabled state)
- [ ] Add core `PluginFeaturePolicyService` (effective policy from hard-disable + tenant plugin config)
- [ ] Extend `RoutesRegistrar` with `requiredFeatures` route option
- [ ] Enforce `requiredFeatures` in core route middleware before plugin handlers
- [ ] Return standardized `403 E_FEATURE_DISABLED` on denied feature access
- [ ] Add functional tests proving direct API calls cannot bypass disabled features
- [ ] Add tests for hard-disable precedence over tenant/plugin toggles

### Phase 4: Manifest + validation
- [ ] Add `tier: "C"` to manifest schema
- [ ] Add `definedHooks`, `definedFilters` to manifest schema
- [ ] Add `requiresEnterprise`, `requiredEnterpriseFeatures` to manifest schema
- [ ] Add Tier C core capabilities to capability registry (`core:service:*`, `core:hooks:define`, `core:entity:fk:users`)
- [ ] Update `validatePluginManifest()` to reject `core:*` capabilities on Tier A/B
- [ ] Validate `authzNamespace` is NOT present in Tier C manifests (derived automatically)
- [ ] Validate hook names match `{pluginId}:*` pattern
- [ ] Validate `core:hooks:define` is requested when `definedHooks`/`definedFilters` are non-empty
- [ ] Update marketplace manifest validation CI
- [ ] Unit tests: manifest validation (valid + all invalid cases)
- [ ] Unit tests: reject Tier C manifest with explicit authzNamespace field
- [ ] Unit tests: reject manifest with `definedHooks`/`definedFilters` but missing `core:hooks:define`
- [ ] Unit tests: treat `core:entity:fk:users` as migration/review capability only (no runtime facade mapping)
- [ ] Unit tests: accept canonical existing app capability IDs (`app:routes`, `app:db:read`, etc.) alongside new Tier C `core:*` IDs

### Phase 5: Security + audit
- [ ] Add audit records for facade write operations
- [ ] Add structured logging for facade read operations
- [ ] Implement per-plugin-per-tenant rate limiting for facades
- [ ] Add CI check: Tier C plugins must not import core models directly
- [ ] Add CI check: plugin packages must not call hook dispatch APIs directly
- [ ] Add enhanced review checklist to marketplace review process
- [ ] Unit tests: audit record generation for each write facade
- [ ] Unit tests: rate limit enforcement (within limit, exceeded, keyed by plugin+tenant)
- [ ] Integration tests: end-to-end Tier C plugin creating comment with mention notification

### Phase 6: Documentation
- [ ] Update `plugins-doc.md` with Tier C author guide
- [ ] Create Tier C plugin template in marketplace repo
- [ ] Document facade APIs for plugin authors
- [ ] Document naming conventions (section 1.4 of this spec)
- [ ] Update existing spec documents per section 11 amendments

---

## 13) Resolved decisions (from review)

These were open questions in earlier versions of this spec, now resolved:

**From v1 review:**

1. **Facade lifecycle**: Facades use a per-request factory pattern (`CoreFacadeFactory.forRequest(ctx)`), not boot-time injection. This ensures correct tenant context in every request handler.

2. **Capability granularity**: Each `core:*` capability is independently grantable. No all-or-nothing. Plugins get only the facades they requested and were approved for.

3. **Naming convention**: Hook names use colon (`collab:comment.created`) consistent with existing hooks (`auth:registered`). Capabilities use colon IDs (`app:*`, `core:*`). Abilities use dot IDs (`{pluginId}.{resource}.{action}`).

4. **Hook registration timing**: Late-binding. Listeners can register for any hook name without existence validation. Validation only applies when dispatching.

5. **Failure semantics**: Three distinct phases — manifest validation (rejection), boot plugin-scoped (quarantine), boot structural (boot-fatal). No ambiguity.

6. **`authzNamespace` for Tier C**: Derived as `{pluginId}.` (not configurable). Removed from manifest — the system derives it automatically. Prevents namespace divergence.

7. **`NotificationsFacade` dependency**: Explicitly conditional. If core has no notification service, the facade is `null`. Plugins degrade gracefully. Non-blocking for the rest of Tier C.

**From v2 review:**

8. **Capability denial = `null` facade, not quarantine**: Denied capabilities AND missing core services both produce `null` facades. The plugin boots and runs with reduced functionality. Quarantine only for: (1) `requiresEnterprise` but enterprise absent, or (2) plugin throws during boot. This is the single, consistent model across the entire spec.

9. **No boot-time tier validation duplication**: Tier A/B requesting `core:*` capabilities is caught at manifest validation (CI/install time). Boot step 4 is removed — no duplication of manifest checks at boot.

10. **PermissionsFacade split into two interfaces**: `BootPermissionsRegistrar` (boot-time: `registerAbilities()`) is separate from `PermissionsFacade` (request-scoped: `check/require/grant/revoke`). The factory exposes `permissions: BootPermissionsRegistrar | null` at boot, while `forRequest(ctx).permissions` returns the request-scoped facade.

11. **Example code guards nullable facades**: Deployment prerequisites are checked at boot via `deploymentGrantedCapabilities` (throws → quarantine if impossible in this deployment). Route handlers use request-level capability checks (`facades.grantedCapabilities` / `facades.hasCapability`) before relying on required facades. Optional facades (notifications, hooks) use `if (facades.xxx)` for graceful degradation.

12. **Capability vocabulary alignment**: Existing app capability IDs remain canonical colon IDs (`app:routes`, `app:db:read`, `app:authz`). Tier C introduces additional colon IDs for core service facades (`core:service:users:read`, `core:service:permissions:manage`, `core:entity:fk:users`) that must be added to the capability registry.

**From v3 review:**

13. **HooksFacade vs HookRegistry**: `HooksFacade` wraps `HookRegistry` with namespace validation. Tier C plugins use `HooksFacade` for dispatching plugin-defined hooks (validates manifest declaration + `{pluginId}:` prefix). Plugin-facing `ServerPluginContext.hooks` is listener-only (`HookListenerRegistry`) and does not expose dispatch methods. Any bypass attempt is rejected in review/CI.

14. **Mandatory rules amendment**: The `null`-facade model for Tier C `core:*` capabilities is an explicit exception to the "fail closed on denied capabilities" rule in `plugins-mandatory-rules.md`. Non-`core:*` capabilities (e.g., `app:routes`, `app:db:read`) remain fail-closed for all tiers. The exception and its rationale are documented in the amendment to section 1.2 of mandatory rules (see section 11.2).

15. **Tier C runtime-facade absence = `core: null`**: If no runtime core capability is granted (`core:service:*` / `core:hooks:define`) — including the case where only `core:entity:fk:users` is approved — the factory is not created. The plugin receives `core = null` (same runtime shape as Tier B). No ambiguity between "factory with all-null fields" and "no factory."

16. **Capability scope split (deployment vs request)**: `CoreFacadeFactory.deploymentGrantedCapabilities: ReadonlySet<string>` is boot-time introspection for deployment prerequisites only. `forRequest(ctx)` exposes request-level capability results via `facades.grantedCapabilities` / `facades.hasCapability`, which account for tenant/user/admin entitlements. This avoids conflating boot-time checks with request-scoped authorization.

17. **`definedHooks` requires `core:hooks:define`**: Manifest validation rejects plugins that declare `definedHooks` or `definedFilters` without requesting `core:hooks:define` in `requestedCapabilities`. This prevents plugins from advertising hooks they can never emit.

**From v4 review:**

18. **Hook dispatch compatibility path**: Plugin-facing dispatch on `ServerPluginContext.hooks` is no longer supported. Legacy dispatch usage must migrate to `HooksFacade` (`core.forRequest(ctx).hooks`) or move non-plugin-defined dispatch to core-owned code.

19. **`core:entity:fk:users` semantics**: Treated as a migration/review-time capability only. It gates schema approval and does not map to a runtime facade.

20. **Resource resolver transaction threading**: `ResourceProvider.resolve/exists` now receive `ResourceResolverContext` with `tenantDb`, `tenantId`, and `userId`. Providers must bind queries to this request-scoped transaction.

21. **Rate-limit scope**: Facade limits are keyed by `(pluginId, scopeKey, operation)`, where `scopeKey` is tenant ID for tenant-scoped requests and a reserved global-admin key for explicit non-tenant admin contexts.

22. **Permissions semantics clarified**: `check/require` are read-only and may inspect any namespace; `grant/revoke` remain constrained to the plugin namespace. `registerAbilities()` is explicitly idempotent.

**From v5 review:**

23. **Cross-repo hook typing boundary**: Hook listeners do not require direct dependency on the hook-defining plugin package. Typed augmentation is optional when dependency boundaries allow it; otherwise listeners use string hook names with local runtime payload validation.

24. **Hook contract split made explicit in amendments**: `plugins-system-final.md` amendment now requires a plugin-facing server `HookListenerRegistry`, a browser `ClientHookListenerRegistry`, and a separate core-internal dispatch-capable registry contract.

25. **`registerAbilities()` failure contract**: Namespace/shape violations throw boot errors (plugin-scoped quarantine). Duplicate registrations remain idempotent upserts.

26. **Background jobs and facades**: Tier C facades remain request-scoped only. Background jobs cannot call `forRequest(ctx)` directly and must use core-owned workflows/request paths for core-side actions.

27. **Stale facade error contract**: `StaleFacadeUsageError` is defined with handling guidance (500 + structured log). Plugin code should not suppress it.

28. **Manifest/server-client filter boundary**: `definedHooks` and `definedFilters` are flat namespace-declared lists; runtime dispatch location (server/client) determines execution context.

**From v6 implementation-lock pass:**

29. **Capability denial error contract**: Request-context capability denial is standardized to HTTP 403 with `{ error: 'E_CAPABILITY_DENIED', message: '...' }`.

30. **Resource registry v1 scope**: `ResourceRegistryFacade` remains `resolve + exists` only in v1; `list/search` is deferred to a future versioned extension.

31. **Cross-plugin Tier C communication policy**: Direct cross-plugin facade invocation is disallowed in v1; cross-plugin integration must use hooks.

32. **Facade versioning policy**: `@saas/plugins-core` follows semver for facade contracts.
    - Additive methods/types: minor
    - Deprecations (non-breaking): minor + deprecation notice
    - Removals/signature changes/behavioral breaks: major

33. **Hook discoverability policy**: Marketplace listings auto-generate baseline hook/filter docs from manifest declarations; plugin documentation remains required for payload semantics and usage guidance.

34. **Feature-gate enforcement is core-owned**: plugin feature toggles are resolved by a core `PluginFeaturePolicyService` (hard-disable + tenant plugin config), route-level feature gates are enforced by core middleware, and denied access returns HTTP 403 `E_FEATURE_DISABLED` (non-bypassable by direct API calls).

---

## 14) Open questions

No blocking open questions remain for implementation.

---

End of spec.
