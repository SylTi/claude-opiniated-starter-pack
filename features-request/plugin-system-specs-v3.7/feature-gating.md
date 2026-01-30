# Spec — Entitlements & Capability Gating (Core + Tier B Plugins)
**Admin-configurable plan → capability mapping, secure server enforcement, UX-friendly client snapshot.**

## 0) Purpose
Provide a **single, stable, secure** way for Tier B plugins (and core) to gate functionality based on subscription level **without**:
- querying billing tables directly,
- duplicating pricing logic in plugins,
- relying on client-side checks.

This spec introduces:
- a **Capability Registry** (plugins declare what exists),
- an **Entitlements Engine** (core computes who gets what),
- an **Admin-configurable mapping UI** (platform-level),
- a **Request-scoped Entitlements Snapshot** (fast and consistent),
- a **Plugin-facing API** (`entitlements.has/require`) for server enforcement,
- a **Client-facing read-only snapshot** for UX (not security).

Integrates with your existing hook:
- `app:capabilities:register`

Integrates with enterprise control plane:
- global availability + tenant activation (Option A strict no-break).

---

## 1) Core Concepts

### 1.1 Capability
A stable identifier representing a product feature.

Examples:
- `notes.export.pdf`
- `audit.sinks.splunk`
- `vault.e2ee`
- `plugin.motion.routes`
- `plugin.twitter.ingest`

**Rule:** capability IDs are **plan-agnostic**. Never name capabilities after tiers.

### 1.2 Entitlements
Computed grants for a user in a tenant, based on:
- tenant subscription plan + status
- optional tenant overrides (platform/support controlled)
- enterprise availability/activation gates (deployment + tenant)
- optional tenant feature toggles (tenant-controlled UX)

Entitlements answer:
> “In this request context, is capability X granted?”

---

## 2) Separation of Responsibilities (non-negotiable)

### 2.1 Plugins (Tier B) own
- Declaring capabilities (`app:capabilities:register`)
- Enforcing capabilities server-side (`entitlements.require(...)`)
- Optional UX gating client-side (`useEntitlements().has(...)`)

### 2.2 Core owns
- Mapping subscription plans → capabilities
- Computing entitlements per request
- Admin panel to configure mappings
- Caching + invalidation

### 2.3 Who can configure “who gets what”
- **Platform admin** (SaaS operator) can edit plan → capability mapping.
- **Tenant admin** cannot edit plan mappings (or they can grant themselves paid features).
- Tenant admin may optionally control **feature toggles** only within what their plan grants.

If you want tenant-specific commercial deals:
- use `tenant_capability_overrides` (platform/support role only).

---

## 3) Data Model (DB)

### 3.1 Capability registry (recommended)
`capabilities`
- `id text primary key`
- `owner text not null` (e.g., `core`, `@plugins/foo`)
- `description text null`
- `created_at timestamptz not null`

You may also keep this in-memory, but DB is better for admin UX and auditing.

### 3.2 Versioned plan→capability mapping (strongly recommended)
**Grant sets** allow rollback and auditability.

`plan_capability_grant_sets`
- `id uuid primary key`
- `note text null`
- `created_at timestamptz not null`
- `created_by uuid null`

`plan_capability_grants`
- `grant_set_id uuid not null` FK -> plan_capability_grant_sets(id)
- `plan_id text not null` (or FK to `subscription_tiers`)
- `capability_id text not null` FK -> capabilities(id)
- `granted boolean not null`
Primary key: `(grant_set_id, plan_id, capability_id)`

`subscription_tiers` (or your plan table) must reference the active grant set:
- `active_grant_set_id uuid not null`

### 3.3 Tenant overrides (optional, platform/support controlled)
`tenant_capability_overrides`
- `tenant_id uuid not null`
- `capability_id text not null`
- `granted boolean not null`
- `reason text null`
- `updated_by uuid null`
- `updated_at timestamptz not null`
Primary key: `(tenant_id, capability_id)`

### 3.4 Tenant feature toggles (optional, tenant-controlled UX)
This is not “entitlements”, it is “feature surface control”.

`tenant_capability_toggles`
- `tenant_id uuid not null`
- `capability_id text not null`
- `enabled boolean not null`
- `updated_by uuid null`
- `updated_at timestamptz not null`
Primary key: `(tenant_id, capability_id)`

**Rule:** toggles can only reduce access. They cannot grant beyond entitlements.

---

## 4) Server-Side Runtime API (required)

### 4.1 ServerPluginContext additions
Tier B `ServerPluginContext` must include:
- `entitlements: EntitlementsService`
- (optional) `capabilities: CapabilityRegistry` for introspection/debug

### 4.2 `EntitlementsService` contract
```ts
export interface EntitlementsService {
  has(capabilityId: string, ctx: HttpContext): boolean;
  require(capabilityId: string, ctx: HttpContext): void; // throws 403
  list(ctx: HttpContext): ReadonlySet<string>; // optional
}
```

### 4.3 Stable denial error contract
`require()` throws:
- HTTP 403
- `code: "E_CAPABILITY_DENIED"`
- `meta: { capabilityId, tenantId, userId }`

This supports upgrade prompts and consistent client behavior.

---

## 5) Entitlements Engine (core)

### 5.1 Inputs
Per request:
- `tenantId` (mandatory, trusted)
- `userId` (if authenticated)
- tenant subscription plan + status (core-owned billing logic)
- `active_grant_set_id` for plan
- tenant overrides (optional)
- tenant toggles (optional)
- enterprise availability/activation (deployment.allowed + tenant.enterprise.enabled)

### 5.2 Output
A request-scoped set:
- `ctx.entitlementsSnapshot: Set<string>`

### 5.3 Computation order (important)
Compute effective grants as:

1) `base = grantsFromActiveGrantSet(plan_id)`
2) apply `tenant_capability_overrides` (platform/support)
3) apply enterprise gates:
   - if enterprise module not allowed/active → remove affected capabilities
4) apply tenant toggles (optional):
   - if toggle disabled → remove capability
5) produce final `Set<string>`

---

## 6) Request Lifecycle (must be consistent)

### 6.1 Middleware: resolve tenant + user
Per request:
- resolve `ctx.tenant` and `ctx.user`
- enforce membership and tenant context integrity

### 6.2 Middleware: compute entitlements once
Compute entitlements once and attach to `ctx.entitlementsSnapshot`.

**Rule:** plugins must not compute entitlements themselves.

### 6.3 Cache + invalidation (recommended)
Cache entitlements at tenant or user level.

Suggested cache keys:
- tenant-level: `ent:tenant:{tenantId}:{planVersion}:{grantSetId}`
- user-level: `ent:user:{tenantId}:{userId}:{planVersion}:{grantSetId}` (only if user-specific overrides exist)

Invalidate cache when:
- billing changes: `billing:subscription_updated`, `billing:invoice_paid`
- plan mapping changes: new active grant set for a plan
- tenant override changes
- tenant toggles change

---

## 7) Admin Panel (platform-level) — Plan → Capabilities Mapping

### 7.1 Roles
- `platform_owner` / `platform_billing_admin` can edit plan mappings.
- tenant roles cannot edit plan mappings.

### 7.2 Required pages
1) **Capabilities Registry**
   - searchable list of capabilities
   - shows owner plugin/core
2) **Plan Editor**
   - select plan (tier)
   - checklist of capabilities
   - diff view before save
   - “Create new grant set” on save
   - set new `active_grant_set_id`

### 7.3 Guardrails
- Only map to capabilities that exist in the registry.
- Removing a capability requires confirmation and is audited.
- Optional: “effective_at” scheduling if you want staged rollouts (not required for v1).

### 7.4 Audit
Every change writes:
- `audit:record` with action `entitlements.plan_mapping.updated`
- include old grantSetId → new grantSetId
- include plan_id
- do not include secrets

---

## 8) Tenant Panel (optional) — Feature Toggles
If you include `tenant_capability_toggles`:
- show only capabilities the tenant is entitled to
- allow enabling/disabling within that set
- toggling writes audit record: `entitlements.tenant_toggle.updated`

This is UX only; server enforcement still uses entitlements snapshot.

---

## 9) Tier B Plugin patterns (server-side enforcement)

### 9.1 Guard routes
```ts
router.get('/api/plugin-x/report', async (ctx) => {
  entitlements.require('pluginX.reporting', ctx)
  // secure handler
})
```

### 9.2 Guard privileged actions
If plugin does privileged work, require capability whenever there is a user/tenant context.
If there is no context, enforce tenant-level capability or refuse.

### 9.3 Never gate by plan name
Plugins never check `plan === 'pro'`.
Only check `capabilityId`.

---

## 10) Client-Side UX (optional; not security)

### 10.1 Provide entitlements in initial payload
RootLayout (RSC) fetches `/api/session` (cookie forwarded) and gets:
- `tenantId`
- `user`
- `capabilities: string[]`

Pass to client provider:
- `<PluginProvider initialEntitlements={...}>`

### 10.2 `useEntitlements()`
```ts
const { has } = useEntitlements()
if (!has('pluginX.reporting')) return <UpgradeCTA />
```

---

## 11) SQL / Indexes (performance)

### 11.1 Indexes
```sql
create index if not exists plan_capability_grants_grantset_plan_idx
  on plan_capability_grants (grant_set_id, plan_id);

create index if not exists plan_capability_grants_grantset_cap_idx
  on plan_capability_grants (grant_set_id, capability_id);

create index if not exists tenant_capability_overrides_tenant_idx
  on tenant_capability_overrides (tenant_id);

create index if not exists tenant_capability_toggles_tenant_idx
  on tenant_capability_toggles (tenant_id);

create index if not exists capabilities_owner_idx
  on capabilities (owner);
```

### 11.2 Query: get base grants for a tenant’s plan (active grant set)
```sql
select g.capability_id
from subscription_tiers t
join plan_capability_grants g
  on g.grant_set_id = t.active_grant_set_id
where t.id = $1
  and g.plan_id = $1
  and g.granted = true;
```

(If `plan_id` equals tier id, simplify accordingly.)

### 11.3 Query: tenant overrides
```sql
select capability_id, granted
from tenant_capability_overrides
where tenant_id = $1;
```

### 11.4 Query: tenant toggles
```sql
select capability_id, enabled
from tenant_capability_toggles
where tenant_id = $1;
```

---

## 12) Implementation Order
1) Capability registry + `app:capabilities:register` integration
2) Plan mapping tables + versioned grant sets + platform admin UI
3) Entitlements middleware + `EntitlementsService` API
4) Client entitlements snapshot (optional but recommended)
5) Cache + invalidation via billing and mapping changes

---

End of spec.
