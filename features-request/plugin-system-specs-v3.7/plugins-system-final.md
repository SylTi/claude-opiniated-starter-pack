# Plugin System — Final (Security-first, tenant-mandatory + RLS)
**Stack:** Next.js (App Router) + AdonisJS + Postgres (Supabase) + pnpm strict monorepo  
**Goal:** Tier A/B plugin extensibility + Tier C implemented in core with tightly controlled “Enterprise Providers”.

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
- Provide “full-blown apps” mounted under `/apps/{pluginId}/...`
- Register API routes under `/apps/{pluginId}/...`
- Register background jobs
- Own plugin tables/migrations (still tenant-scoped)

### Tier C — Enterprise/infra features
Tier C is **core code** (not plugins).  
Extensibility happens only via **Type 1 — Enterprise Providers** (contracts implemented by internal packages).

---

## 2) Capabilities and enforcement

Plugins declare `requestedCapabilities`. Core enforces:
- **enabled/disabled** state per tenant
- capability approvals
- namespace scoping for routes/storage
- audit logging for privileged operations

Denied capabilities must **fail closed** (boot isolation, not app crash).

---

## 3) Hook registry (Actions & Filters)

### 3.1 Contracts (typed)
```ts
// @pkg/hooks (shared concept; different instances in API and Browser)
export type HookCallback<TArgs extends any[] = any[]> = (...args: TArgs) => void | Promise<void>;
export type FilterCallback<TArgs extends any[] = any[], TResult = any> =
  (...args: TArgs) => TResult | Promise<TResult>;

export interface HookRegistry {
  registerAction<H extends string>(
    hook: H,
    cb: HookCallback<any[]>,
    priority?: number
  ): () => void;

  registerFilter<H extends string>(
    hook: H,
    cb: FilterCallback<any[], any>,
    priority?: number
  ): () => void;

  dispatchAction(hook: string, ...args: any[]): Promise<void>;
  applyFilters<T>(hook: string, initial: T, ...args: any[]): Promise<T>;
}
```

### 3.2 Runtime requirements
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
- `/apps/{pluginId}/...`

Plugins do **not** get raw router access; they receive a facade that enforces:
- namespace prefix
- middleware defaults (auth/tenant context)
- rate limits (optional)
- capability checks

---

## 6) Enterprise Providers (Type 1 — tightly controlled contracts)

Tier C stays in core, but integrations are providers.

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

Dependencies and cascade rules are documented in `interdependencies.md`.

Examples:
- Tier A: `examples-plugins/tierA/*`
- Tier B: `examples-plugins/tierB/*`

---

## 8) Dev workflow (packages built + watcher)
- internal packages (`@pkg/*`) and server plugin entrypoints build to `dist/`
- Adonis dev restarts on workspace dist changes (external watcher; avoid metaFiles pollution)

---

End of document.
