# Plugin System — Final (Security-first, tenant-mandatory + RLS)
**Stack:** Next.js (App Router) + AdonisJS + Postgres (Supabase) + pnpm strict monorepo  
**Goal:** Tier A/B/C plugin extensibility with strict isolation, plus tightly controlled core-owned Enterprise Providers.

---

## 0) Non-negotiables

### Tenant is mandatory
- Every authenticated request has a **current tenant**.
- Every tenant-scoped table has `tenant_id NOT NULL`.
- Authorization and entitlements are evaluated in `(user, tenant)` context.

### RLS is mandatory (Postgres)
- The database enforces tenant boundaries.
- The API must run queries inside a request-scoped transaction with `SET LOCAL app.tenant_id` (and `app.user_id`).

See `rls.md` for the concrete blueprint.

---

## 1) Plugin tiers

### Tier A — UI plugins (unprivileged)
- Filters: nav/menu/settings/theme/i18n
- Slots: widget injection points
- No secrets, no DB, no auth/crypto primitives.

### Tier B — App plugins (moderately privileged, in-process)
- Provide “full-blown apps” mounted under UI host route `/apps/{pluginId}/...`
- Register API routes under `/api/v1/apps/{pluginId}/...`
- Register background jobs
- Own plugin tables/migrations (still tenant-scoped)

### Tier C — Platform plugins (privileged, marketplace)
Tier C plugins are **marketplace-distributable plugins with controlled core service access**.
They access core capabilities through constrained facades (request-scoped, audited, rate-limited).
See `tier-c-platform-plugins-spec.md` for the full Tier C contract.

---

## 2) Capabilities and enforcement

Plugins declare `requestedCapabilities`. Core enforces:
- **enabled/disabled** state per tenant
- capability approvals
- namespace scoping for routes/storage
- audit logging for privileged operations

Denied capabilities must **fail closed** (boot isolation, not app crash),
except Tier C `core:*` capabilities, which may degrade to `null` facades
as defined in `tier-c-platform-plugins-spec.md`.

Tier C `core:*` capabilities can be evaluated in two scopes:
- deployment scope (boot prerequisites / wiring),
- request scope (tenant/user/admin entitlements).
See `tier-c-platform-plugins-spec.md` for the exact split.

---

## 3) Hook registry (Actions & Filters)

### 3.1 Contracts (typed)
```ts
// @pkg/hooks (shared concept; different instances in API and Browser)
export type HookCallback<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => void | Promise<void>;
export type FilterCallback<TArgs extends unknown[] = unknown[], TResult = unknown> =
  (...args: TArgs) => TResult | Promise<TResult>;

// Base hook maps to support declaration merging from plugins.
// Plugin packages augment these interfaces in their `./types` exports.
export interface ServerActionHooks {}
export interface ServerFilterHooks {}
export interface ClientFilterHooks {}

export interface HookListenerRegistry {
  registerAction<H extends keyof ServerActionHooks & string>(
    hook: H,
    cb: HookCallback<ServerActionHooks[H] extends unknown[] ? ServerActionHooks[H] : unknown[]>,
    priority?: number
  ): () => void;
  registerAction(
    hook: string,
    cb: HookCallback<unknown[]>,
    priority?: number
  ): () => void;

  registerFilter<H extends keyof ServerFilterHooks & string>(
    hook: H,
    cb: FilterCallback<ServerFilterHooks[H] extends unknown[] ? ServerFilterHooks[H] : unknown[], unknown>,
    priority?: number
  ): () => void;
  registerFilter(
    hook: string,
    cb: FilterCallback<unknown[], unknown>,
    priority?: number
  ): () => void;
}

// Browser/plugin-client surface
export interface ClientHookListenerRegistry {
  registerFilter<H extends keyof ClientFilterHooks & string>(
    hook: H,
    cb: FilterCallback<ClientFilterHooks[H] extends unknown[] ? ClientFilterHooks[H] : unknown[], unknown>,
    priority?: number
  ): () => void;
  registerFilter(
    hook: string,
    cb: FilterCallback<unknown[], unknown>,
    priority?: number
  ): () => void;
}

// Core-internal only. Not exposed to plugin-facing ServerPluginContext.
export interface HookRegistryInternal extends HookListenerRegistry {
  dispatchAction(hook: string, ...args: any[]): Promise<void>;
  applyFilters<T>(hook: string, initial: T, ...args: any[]): Promise<T>;
}
```

### 3.2 Runtime requirements
- Plugin-facing server context exposes listener registration only (`HookListenerRegistry`).
- Plugin-facing browser context exposes filter registration via `ClientHookListenerRegistry`.
- `dispatchAction/applyFilters` are core-internal and must not be exposed on plugin-facing hooks.
- Tier C plugin-defined hook emission goes through `HooksFacade` (capability + manifest + namespace validation).
- Browser runtime uses the same typed-hook model, with client filter hooks represented by `ClientFilterHooks`.
- Deterministic ordering: `(priority asc, registrationOrder asc)`
- Error isolation: one plugin failure does not break others
- Optional timeouts for long hooks
- Observability: metrics + audit record on failures (for Tier B)

---

## 4) Plugins as packages (bundler-safe discovery)

No `fs.readdir`. No dynamic string imports.

### 4.1 Loader maps in `@pkg/config`
- `plugins.client.ts`: `clientPluginManifests` + `clientPluginLoaders`
- `plugins.server.ts`: `serverPluginManifests` + `serverPluginLoaders`

### 4.2 pnpm strict rule
Anything that resolves plugin packages (migrations, metadata) must execute in the package that **declares** plugin deps (here: `@pkg/config`).

---

## 5) App plugins: routing model

### 5.1 Next.js: host route
Core provides **one** catch-all:
- `/apps/[pluginId]/[[...path]]`

It loads a plugin “app module” from the static loader map and renders plugin pages.

### 5.2 Adonis: namespaced routes
Plugins register routes only under:
- `/api/v1/apps/{pluginId}/...`

Plugins do **not** get raw router access; they receive a facade that enforces:
- namespace prefix
- middleware defaults (auth/tenant context)
- rate limits (optional)
- capability checks
- feature-policy checks (route-level required features, core-enforced)

Feature-policy denial contract:
- HTTP `403`
- `{ error: "E_FEATURE_DISABLED", message: "Feature <id> is disabled for this tenant" }`

---

## 6) Enterprise Providers (Type 1 — tightly controlled contracts)

Enterprise Providers are core-owned integrations and are distinct from Tier C Platform Plugins.
Tier C Platform Plugins are marketplace plugins with constrained facade access.
Enterprise Providers are internal contracts for enterprise infrastructure extensions.

### 6.1 KeyProvider (wrap/unwrap record DEKs)
Used by **at-rest encryption** and **encrypted backups**.

```ts
export type KeyRef = { provider: string; keyId: string; version?: string };

export interface KeyProvider {
  readonly id: string; // e.g. "server-managed" | "byok-kms" | "byok-vault"

  // Called on boot; provider can validate config and connectivity.
  validate(): Promise<void>;

  // Wrap/unwrap a per-record DEK (envelope encryption).
  wrapDEK(dek: Uint8Array, ctx: { tenantId: string; purpose: "at-rest" | "backup" }): Promise<{
    wrappedDEK: Uint8Array;
    keyRef: KeyRef;
  }>;

  unwrapDEK(wrappedDEK: Uint8Array, keyRef: KeyRef, ctx: { tenantId: string; purpose: "at-rest" | "backup" }): Promise<Uint8Array>;

  // Optional rotations (explicit workflows; never implicit magic).
  supportsRotation: boolean;
}
```

**Default provider:** `ServerManagedKeyProvider` (one MK per deployment)  
**Enterprise provider:** `BYOKKeyProvider` (KMS/Vault/CMK)

Rule: data is encrypted **once** (DEK), provider only controls DEK wrapping.

### 6.2 AuditSink (export/forward audit events)
```ts
export interface AuditSink {
  readonly id: string; // "datadog" | "splunk" | "s3-worm" ...
  validate(): Promise<void>;
  ingest(event: { tenantId: string; type: string; at: string; actor?: any; meta?: any }): Promise<void>;
}
```

### 6.3 SSOProvider (OIDC/SAML)
```ts
export interface SSOProvider {
  readonly id: string; // "oidc" | "saml"
  validate(tenantId: string): Promise<void>;

  // Start auth flow; core owns session issuance.
  start(tenantId: string, params: Record<string, string>): Promise<{ redirectUrl: string }>;

  // Handle callback; provider returns verified identity + claims.
  callback(tenantId: string, params: Record<string, string>): Promise<{
    externalUserId: string;
    email?: string;
    displayName?: string;
    claims: Record<string, unknown>; // groups, assurance, etc.
  }>;
}
```

### 6.4 RBAC RulePack (extensions only)
RBAC core is mandatory; extensions register deterministic rules.
```ts
export type RuleDecision = "allow" | "deny" | "abstain";

export interface RbacRule {
  id: string;
  description: string;
  evaluate(input: { tenantId: string; userId: string; action: string; resource: any; context?: any }): Promise<RuleDecision> | RuleDecision;
}

export interface RbacRulePack {
  readonly id: string;
  rules(): RbacRule[];
}
```

---

## 7) Implementation documents
Core features live in `core/`:
- `core/mandatory/*`
- `core/toConf/*`
- `core/plugAndPlay/*`

Enterprise feature dependencies and cascade rules are documented in `interdependencies.md`.
Plugin-to-plugin dependency enforcement is documented in `plugin-dependency-enforcement-spec.md`.

**Implementation deviations:** See `implementation-deviations.md` for conscious divergences from this spec (API versioning, integer IDs) that align with our existing architecture.

Examples:
- Tier A: `examples-plugins/tierA/*`
- Tier B: `examples-plugins/tierB/*`

---

## 8) Dev workflow (packages built + watcher)
- internal packages (`@pkg/*`) and server plugin entrypoints build to `dist/`
- Adonis dev restarts on workspace dist changes (external watcher; avoid metaFiles pollution)

---

End of document.
