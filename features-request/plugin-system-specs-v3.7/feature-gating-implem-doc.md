# Plugin Author Docs — Entitlements & Subscription Gating (Tier B)
**How Tier B plugins should declare and enforce gated features safely.**

## 0) The rule of the game
Your plugin **does not** know what “Pro” or “Enterprise” means.

Your plugin only knows **capabilities**:
- it declares them,
- it enforces them.

The core app decides which subscription plans grant which capabilities, via a platform admin panel.

---

## 1) What you can access (relevant subset)
On the server (Tier B context):
- `hooks` (actions/filters)
- `router` (if Tier B allows routes in your system)
- `entitlements` service:
  - `has(capabilityId, ctx)`
  - `require(capabilityId, ctx)` (throws 403)
- `ctx.tenantId` and `ctx.user` (from request context)

On the client (UX only):
- `useEntitlements().has(capabilityId)`

---

## 2) Declare your capabilities (boot-time)
Use the server hook you’re given:
- `app:capabilities:register`

Example:
```ts
hooks.registerAction('app:capabilities:register', (registry) => {
  registry.define('pluginX.reporting', {
    description: 'View plugin X reports',
    owner: '@plugins/plugin-x',
  })

  registry.define('pluginX.export.csv', {
    description: 'Export plugin X data as CSV',
    owner: '@plugins/plugin-x',
  })
})
```

Guidelines:
- Namespace everything: `pluginId.area.action`
- Keep capability IDs stable forever (renaming breaks mappings)
- Prefer multiple small capabilities over one mega-capability

---

## 3) Enforce capabilities on the server (mandatory)

### 3.1 Guard API routes
```ts
router.get('/api/plugin-x/report', async (ctx) => {
  entitlements.require('pluginX.reporting', ctx)
  return { ok: true }
})
```

### 3.2 Guard privileged operations
If your plugin listens to hooks and performs privileged work:
- enforce `require()` whenever you have a `ctx`
- if you don’t have a request context, enforce at tenant scope (if your platform exposes that) or refuse.

Never rely on UI gating.

---

## 4) Client-side gating (optional UX)
If you expose UI elements, you can hide/show them using the entitlements snapshot.

```ts
const { has } = useEntitlements()
if (!has('pluginX.export.csv')) return <UpgradeCTA />
```

This is UX only; server must still enforce.

---

## 5) What happens when access is denied
If `entitlements.require()` fails:
- response is 403
- error code is `E_CAPABILITY_DENIED`
- metadata includes `capabilityId`

Your UI should:
- show “Upgrade required”
- optionally show which capability is missing (support/debug)
- link to billing

Do not swallow the error.

---

## 6) What you must NOT do
- ❌ Read billing/subscription tables
- ❌ Check plan names (`pro`, `enterprise`, etc.)
- ❌ Gate only in the UI
- ❌ Rename capability IDs casually
- ❌ Implement your own entitlement caching

---

## 7) How plans get mapped to your capabilities
Platform admins manage mapping in the core admin panel:
- they select a plan
- they tick capabilities (including yours)
- the system versions and applies the mapping

If your plugin expects certain capabilities to be granted for certain tiers:
- document that expectation in your plugin README
- do not enforce tier logic yourself

---

## 8) Testing checklist
- [ ] Capability registration works (appears in admin registry)
- [ ] Admin can map plan → capability
- [ ] Server route rejects without capability (403 `E_CAPABILITY_DENIED`)
- [ ] Server route works with capability
- [ ] UI hides/shows based on `useEntitlements().has()`
- [ ] Works for user in multiple tenants with different entitlements

---

End of plugin docs.
