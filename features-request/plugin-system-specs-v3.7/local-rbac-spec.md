# Spec Addon — Tier B Local RBAC for Plugin-Owned Resources
**Secure, tenant-scoped, RLS-compatible, and enforceable through a single core authorization surface.**

## 0) Goal
Allow Tier B plugins to implement **tenant-scoped RBAC** (roles/groups/scopes) for **plugin-owned resources** while maintaining:
- a single enforcement choke point in core,
- consistent error behavior,
- consistent auditing,
- no bypass paths.

This spec intentionally does **not** let plugins alter core authorization semantics for core resources.
It only supports authorization for:
- plugin-owned abilities (namespaced)
- plugin-owned resources (tables/entities owned by that plugin)

---

## 1) Threat Model & Non-Negotiables

### 1.1 Threats we are preventing
- Plugin implements local RBAC but forgets to check it everywhere → privilege escalation
- Plugin accidentally leaks cross-tenant data (missing tenant_id) → RLS bypass risk
- Plugin returns “allow” for a user not in tenant → multi-tenant access bug
- Plugins disagree on semantics → inconsistent security & audit posture

### 1.2 Non-negotiable invariants
1) **All authorization checks must pass through Core `AuthzService`.**
   - Plugins do not do “manual” role checks in route handlers as the only gate.
2) **Tenant context is mandatory and trusted.**
   - `ctx.tenantId` must exist, be validated, and aligned with RLS.
3) **Plugin abilities must be namespaced.**
   - Core routes checks to the owning plugin resolver based on namespace.
4) **Default deny.**
5) **Audit every change to RBAC state.**
6) **No plugin can authorize access to core resources.**
   - Only plugin resources.

---

## 2) Contracts (Tier B)

### 2.1 Add `authz` to `ServerPluginContext` (required)
```ts
export type AuthzCheck = {
  ability: string                    // e.g. "motion.board.write"
  resource?: { type: string; id: string | number } // e.g. {type:"board", id:123}
}

export type AuthzDecision = {
  allow: boolean
  reason?: string                    // stable debug reason (no secrets)
}

export interface AuthzService {
  registerNamespace(
    namespace: string,               // e.g. "motion."
    resolver: AuthzResolver
  ): void

  has(ctx: HttpContext, check: AuthzCheck): Promise<boolean>
  require(ctx: HttpContext, check: AuthzCheck): Promise<void> // throws 403
}

export type AuthzResolver = (
  ctx: HttpContext,
  check: AuthzCheck
) => Promise<AuthzDecision>
```

### 2.2 Add an explicit hook for registration (recommended)
Core emits during boot:
- `app:authz:register` (payload: `{ authz }`)

Plugins register their namespace resolvers here.

---

## 3) Namespacing Rules

### 3.1 Ability ID format
`{pluginId}.{resourceType?}.{action}`

Examples:
- `motion.board.read`
- `motion.board.write`
- `motion.admin`
- `twitter.ingest.run`
- `udemy.course.sync`

### 3.2 Namespace ownership
Each plugin must declare:
- `pluginId` (already exists)
- `authzNamespace: "motion."`

Core must guarantee:
- only one plugin may register a given namespace
- duplicate namespace registration is a boot-fatal error

---

## 4) Enforcement Model (How checks are executed)

### 4.1 Core enforcement API (single choke point)
Plugins and core call:
```ts
await authz.require(ctx, { ability, resource })
```

### 4.2 Routing to resolvers
Core routes checks as follows:

1) Validate `ctx.tenantId` exists and is trusted.
2) Determine owning namespace:
   - the namespace is the prefix up to first dot + trailing dot, e.g. `motion.`
3) If ability is plugin namespaced:
   - locate resolver by namespace
   - call resolver
4) If no resolver exists:
   - deny (default deny)
5) If ability is core ability:
   - handle via core RBAC (existing Bouncer) OR deny, depending on your RBAC architecture

**Plugins never bypass this by calling their own table checks directly as the only enforcement.**

---

## 5) Recommended Plugin RBAC Data Model (Pattern A — resource grants)
Pattern A is the safest v1: explicit grants bound to concrete resources.

### 5.1 Tables (tenant-scoped, RLS required)
**Roles**
`plugin_{id}_roles`
- `tenant_id`
- `id`
- `name`
- `created_at`

**Role members**
`plugin_{id}_role_members`
- `tenant_id`
- `role_id`
- `user_id`
- unique `(tenant_id, role_id, user_id)`

**Role abilities (global within tenant)**
`plugin_{id}_role_abilities`
- `tenant_id`
- `role_id`
- `ability_id`
- `effect` enum('allow','deny') default 'allow' (deny optional)
- unique `(tenant_id, role_id, ability_id)`

**Role resource grants (scopes)**
`plugin_{id}_role_resource_grants`
- `tenant_id`
- `role_id`
- `ability_id` (optional: if null, applies to all abilities for that resource type; v1 prefer explicit)
- `resource_type`
- `resource_id`
- unique `(tenant_id, role_id, ability_id, resource_type, resource_id)`

### 5.2 RLS requirements
Every table:
- must include `tenant_id`
- must have RLS policy using your tenant session var (e.g. `app.current_tenant_id()`)

**Mandatory rule:** plugin migrations must include tenant_id + RLS policies, or build fails.

---

## 6) Resolver Semantics (required)

### 6.1 Default deny
If any required data is missing (no tenant, no user, no membership):
- deny

### 6.2 Effective allow logic (Pattern A)
Given `ctx.userId`, `ctx.tenantId`, `ability`, optional resource:

1) Fetch role ids for user in tenant
2) Check role ability grants for `ability`
3) If resource is provided:
   - require a matching `role_resource_grants` row (scoped) OR define a clear policy:
     - “global ability without scope grants everything” (dangerous)
     - v1 recommended: if ability is resource-scoped type, require explicit scope row
4) Return allow if any role grants access (and scope matches if required)

**Prefer allow-only v1** unless you need deny precedence.

### 6.3 Deny precedence (optional)
If you support deny:
- deny wins over allow (safer)
- implement as:
  - if any role denies ability for resource → deny
  - else if any role allows → allow
  - else deny

---

## 7) API / DX for Plugin Authors (expected usage)

### 7.1 Server route gating (mandatory)
```ts
router.put('/api/motion/boards/:id', async (ctx) => {
  entitlements.require('plugin.motion', ctx) // subscription gate (optional but typical)
  await authz.require(ctx, {
    ability: 'motion.board.write',
    resource: { type: 'board', id: ctx.params.id },
  })
  // ...
})
```

### 7.2 UI gating (optional)
Client uses entitlements for UX only.
RBAC decisions remain server-side.

---

## 8) Auditing (mandatory)

### 8.1 RBAC mutation events
When plugin modifies:
- roles
- role membership
- role abilities
- resource grants

It must emit:
- `audit:record` with action identifiers like:
  - `plugin.motion.rbac.role.created`
  - `plugin.motion.rbac.member.added`
  - `plugin.motion.rbac.grant.added`
Include:
- tenant_id
- actor (user/system)
- target user/role/resource ids
- no secrets

### 8.2 Authorization decisions (optional)
Do not log every authz check to audit log (too noisy).
If you need it:
- emit structured debug logs or sampling.

---

## 9) Validation & Enforcement in Core (build-time & runtime)

### 9.1 Build-time enforcement (migration lint)
Core must enforce plugin mandatory rules:
- plugin migrations must include `tenant_id` and RLS policies
- plugin tables must not be global unless explicitly allowed (rare)
- deny merging plugin that violates this (CI lint step)

### 9.2 Runtime enforcement
Core `authz.registerNamespace()` must:
- reject duplicate namespaces
- reject namespaces not matching pluginId prefix (optional but recommended)

Core `authz.require()` must:
- throw standardized 403:
  - code: `E_AUTHZ_DENIED`
  - meta: { ability, tenantId, userId, resource? }

---

## 10) Interop With Core RBAC (mandatory separation)
- Core RBAC remains authoritative for core resources.
- Plugin authz resolvers may not run for core abilities.
- Plugins cannot inject rules into core resource permissions (Tier C only, if ever).

---

## 11) Implementation Plan (order)
1) Add `AuthzService` to core and ServerPluginContext
2) Add `app:authz:register` hook and namespace registration
3) Implement ability→namespace routing + default deny
4) Provide reference plugin example implementing Pattern A tables + resolver
5) Add CI lint for plugin migrations (tenant_id + RLS) if not already present
6) Add admin UI for plugin RBAC management (optional; can be plugin-provided)

---

End of spec.
