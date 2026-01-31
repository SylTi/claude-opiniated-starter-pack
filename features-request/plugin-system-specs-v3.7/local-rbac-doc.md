# Plugin Author Docs — Local RBAC for Plugin-Owned Resources (Tier B)
**Tenant-scoped roles/groups + scopes, enforced through core `AuthzService`.**

This document explains how to implement **local RBAC** (roles/groups/scopes) inside a Tier B plugin **securely**, without creating a parallel authorization system.

---

## 0) What this enables
Your plugin can define tenant-scoped permissions for your own resources, like:
- access groups
- roles
- resource-level scopes (e.g., “only these boards”)

Examples of plugin-level questions:
- “Can this user edit Board #123?”
- “Can this user see all projects, or only scoped ones?”

---

## 1) The non-negotiable rule
**All authorization decisions must be enforced via core `authz.require()` in server code.**

You must never rely on:
- hiding UI only
- ad-hoc checks scattered across handlers
- client-side checks

If you do, your plugin will ship a bypass.

---

## 2) What you get from the platform (Tier B context)
On the server, your plugin receives:
- `authz` service:
  - `registerNamespace(namespace, resolver)`
  - `has(ctx, check)`
  - `require(ctx, check)` → throws 403 (`E_AUTHZ_DENIED`)
- `entitlements` service (subscription gating):
  - `require(capabilityId, ctx)` → throws 403 (`E_CAPABILITY_DENIED`)
- tenant context:
  - `ctx.tenantId` exists and is trusted
- user context:
  - `ctx.user` / `ctx.userId` exists when authenticated

---

## 3) Choose your namespace and ability IDs

### 3.1 Namespace
Pick a namespace for your plugin:
- `motion.` for plugin `motion`

You register it once at boot.

### 3.2 Ability IDs
Use stable IDs:
- `motion.board.read`
- `motion.board.write`
- `motion.admin`

Rules:
- stable forever (renaming breaks permissions)
- keep them small and composable
- do not encode subscription tiers in ability IDs

---

## 4) Register your authz resolver (boot-time)

You register your namespace during plugin boot.

Example:
```ts
export default async function MotionPluginServer({ authz, hooks, db }: ServerPluginContext) {
  hooks.registerAction('app:authz:register', ({ authz }) => {
    authz.registerNamespace('motion.', async (ctx, check) => {
      return resolveMotionAuthz(ctx, check)
    })
  })
}
```

Important:
- only register your namespace once
- duplicate namespace registration will crash boot (by design)

---

## 5) Enforce authorization in every privileged route (mandatory)

### 5.1 Example: update a resource
```ts
router.put('/api/motion/boards/:id', async (ctx) => {
  // 1) Subscription gate (optional but typical)
  entitlements.require('plugin.motion', ctx)

  // 2) Authorization gate (mandatory)
  await authz.require(ctx, {
    ability: 'motion.board.write',
    resource: { type: 'board', id: ctx.params.id },
  })

  // 3) Now you can proceed
  // update board...
})
```

### 5.2 When to include a resource
- If the permission is resource-level, always pass resource `{type,id}`.
- If it’s tenant-global (e.g. `motion.admin`), omit resource.

---

## 6) Recommended DB schema (Pattern A — explicit resource grants)
This is the safest and easiest v1.

All tables must be tenant-scoped:
- every row has `tenant_id`
- RLS policies are mandatory

### 6.1 Roles
`plugin_motion_roles`
- tenant_id
- id
- name

### 6.2 Role members
`plugin_motion_role_members`
- tenant_id
- role_id
- user_id

### 6.3 Role abilities
`plugin_motion_role_abilities`
- tenant_id
- role_id
- ability_id
- effect ('allow' | 'deny') (optional; v1 can be allow-only)

### 6.4 Role resource grants (scopes)
`plugin_motion_role_resource_grants`
- tenant_id
- role_id
- ability_id
- resource_type
- resource_id

---

## 7) RLS and tenant safety (mandatory)

### 7.1 Every plugin table must include tenant_id
If you forget tenant_id, you will leak data or break enforcement.

### 7.2 RLS policies must exist for plugin tables
Your migrations must:
- enable RLS
- define policies keyed to the app’s current tenant context

If you are unsure how your platform sets tenant context for RLS:
- do not guess
- use the platform-provided helper function (recommended)
- follow `plugins-mandatory-rules.md` in your repo

---

## 8) Resolver logic (how to decide allow/deny)

### 8.1 Default deny
If anything is missing:
- no tenantId
- no userId
- not a member
- unknown ability
Return deny.

### 8.2 Minimal allow-only logic (recommended v1)
Pseudo:
1) find roles for (tenantId, userId)
2) check if any role has `ability_id = requested ability`
3) if resource is provided:
   - require a matching scope row for that (role, ability, resource_type, resource_id)
4) allow if found; else deny

### 8.3 Deny precedence (optional)
If you support `deny`:
- deny must override allow
- implement it carefully and test thoroughly

---

## 9) Auditing your RBAC changes (mandatory)
Whenever you mutate RBAC state, emit an audit event:
- role created/updated/deleted
- member added/removed
- ability grant added/removed
- resource scope grant added/removed

Use `audit:record` with:
- actor (who did it)
- tenant_id
- action string
- meta: role_id, user_id, ability_id, resource_id (no secrets)

Examples:
- `plugin.motion.rbac.role.created`
- `plugin.motion.rbac.member.added`
- `plugin.motion.rbac.grant.added`

Do not log every permission check; that’s too noisy.

---

## 10) UX guidance (optional)
- show RBAC management UI inside your plugin admin pages
- always reflect server truth (don’t assume client checks are enough)
- for denied actions, surface:
  - “You don’t have access”
  - ability ID (optional, for support)
  - tenant admin instructions

---

## 11) Testing checklist (do not skip)
- [ ] Namespace registered correctly
- [ ] Abilities are stable and namespaced
- [ ] Every privileged route uses `authz.require()`
- [ ] Cross-tenant access is impossible (RLS tested)
- [ ] Missing scope rows deny access
- [ ] Membership changes take effect immediately
- [ ] Audit events fire on every RBAC mutation

---

## 12) Common mistakes that will get you rejected
- ❌ No tenant_id on tables
- ❌ No RLS policies
- ❌ Only checking RBAC in UI
- ❌ Doing ad-hoc “if (isAdmin)” checks without `authz.require()`
- ❌ Renaming ability IDs after release
- ❌ Allowing global access because “it’s easier”

---

End of document.
