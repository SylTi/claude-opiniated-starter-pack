# Spec Addon - Plugin UI Host Access Control (`/apps/*`)
**Goal: add a centralized, fail-closed admission gate for plugin-hosted UI routes while keeping API authz authoritative.**

## 0) Problem
Today, plugin host routes under `/apps/[pluginId]/...` are effectively authentication-only.
That means any logged-in user can attempt to open plugin UI pages unless each plugin remembers to block access itself.

This spec introduces a core admission policy for plugin UI routes.

---

## 1) Scope
In scope:
- Access control for web plugin host routes (`/apps/*`)
- Declarative plugin access policy in `plugin.meta.json`
- Deterministic server-side evaluation in host layout
- Clear interaction with existing AuthzService

Out of scope:
- Replacing backend authorization checks
- Row-level/entity-level authorization
- Runtime JS callbacks from plugin code during host admission

---

## 2) Security Model
1. **Fail-closed by default** for policy evaluation errors.
2. **Core host gate is coarse admission only** (can user enter plugin UI route namespace?).
3. **Backend authz remains authoritative** for data/actions.
4. **Plugin rules are additive only** in V1 (plugins can restrict more, not relax core minimums).

---

## 3) Manifest Contract (V1)
Add optional `accessControl` to `plugin.meta.json`:

```json
{
  "accessControl": {
    "version": 1,
    "default": "authenticated",
    "rules": [
      {
        "path": "/admin/*",
        "require": {
          "rolesAny": ["admin"],
          "entitlementsAny": ["plugin.notes.admin"]
        }
      },
      {
        "path": "/reports/*",
        "require": {
          "entitlementsAny": ["plugin.notes.reports.read"]
        }
      }
    ]
  }
}
```

### 3.1 Fields
- `version`: required, currently `1`
- `default`: one of:
  - `authenticated` (recommended default)
  - `deny`
  - `public` (rare; still subject to global safe mode and plugin availability)
- `rules`: optional list of path-specific requirements

### 3.2 Rule shape
- `path`: glob-like pattern relative to plugin route remainder
  - examples: `/`, `/*`, `/admin/*`, `/reports/:id` (exact path syntax should be standardized in implementation)
- `require.rolesAny`: optional array of user roles (`admin`, `user`, `guest`)
- `require.entitlementsAny`: optional array of entitlement keys

### 3.3 Validation
Manifest validation fails if:
- unsupported `version`
- invalid `default`
- invalid role names
- empty `rules` entries or malformed `path`

In production, invalid `accessControl` for a plugin should quarantine that plugin.

---

## 4) Evaluation Algorithm (`/apps/[pluginId]/...`)
Given authenticated user + plugin manifest:

1. Load and validate plugin manifest.
2. If no `accessControl`, apply backward-compatible default:
   - `default = authenticated`
3. Build path context from requested route suffix.
4. Find matching rules (most specific first).
5. Evaluate matched rule requirements:
   - all requirement groups in one rule must pass
   - for each group (`rolesAny`, `entitlementsAny`), "any" semantics
6. If no rule matches, evaluate `default`.
7. If denied:
   - return 403-style response (not 404)
   - emit audit event (`plugin.ui.access_denied`)

If policy parsing/evaluation errors occur, deny access (fail-closed) and log incident.

---

## 5) Rule Composition and Plugin Overrides
V1 composition:
- Core minimum: authenticated user (unless `public`)
- Plugin rules may only **add** restrictions.
- Plugin rules cannot disable safe mode restrictions or bypass core invariants.

Bypass/relaxation:
- **Not supported in V1**.
- Future V2 may define explicit dangerous override capability + platform allowlist + mandatory audit.

---

## 6) Interaction with Existing Authz
This host gate does **not** replace authz.

Required invariant:
- APIs/server actions must continue to call AuthzService for operation/resource checks.

Recommended layering:
1. Host gate (`/apps/*`) blocks obviously unauthorized users early.
2. Backend authz enforces definitive permissions on every sensitive operation.

---

## 7) Data Sources for Evaluation
Minimum claims needed at host evaluation time:
- `role`
- optional entitlements set (recommended)

If entitlements are unavailable at layout time:
- rules using `entitlementsAny` should fail-closed or require a precomputed entitlements cookie/claim.
- implementation should not silently skip entitlement checks.

---

## 8) UX and Error Behavior
On denial:
- show explicit Access Denied page
- include safe, non-sensitive reason category (e.g. `missing_role`, `missing_entitlement`)
- do not leak internal policy details

On unauthenticated:
- redirect to login with callback URL

---

## 9) Audit Events
Add events:
- `plugin.ui.access_allowed` (optional sampling)
- `plugin.ui.access_denied`
- `plugin.ui.policy_error`

Suggested fields:
- `pluginId`
- `path`
- `userId` (if available)
- `tenantId` (if available)
- `reasonCode`

---

## 10) Backward Compatibility
Plugins without `accessControl` continue to work with `authenticated` default.
No breaking change required for existing manifests.

---

## 11) Test Requirements
Must cover:
1. no `accessControl` -> authenticated users allowed
2. unauthenticated -> redirected
3. role-based allow/deny
4. entitlement-based allow/deny
5. malformed policy -> deny + policy_error log
6. path specificity precedence
7. safe mode interaction
8. plugin not found / unsupported tier behavior unchanged

---

## 12) Rollout Plan
Phase 1:
- implement schema + validator + host evaluator
- ship with `authenticated` fallback

Phase 2:
- add entitlement claims to host-evaluable context (if not already present)
- enforce entitlement rules strictly

Phase 3 (optional):
- advanced override model (explicitly dangerous, audited, allowlisted)

---

## 13) Implementation Checklist
Use this as an execution plan mapped to current repository files.

### 13.1 Types and Manifest Schema
- [ ] Add `accessControl` types to `packages/plugins-core/src/types/manifest.ts`
  - `PluginAccessControlV1`
  - `PluginAccessRuleV1`
  - `PluginAccessRequirementV1`
- [ ] Extend `validatePluginManifest(...)` in `packages/plugins-core/src/types/manifest.ts`
  - validate `version === 1`
  - validate `default` enum
  - validate rule shape and role values
- [ ] Add tests in `packages/plugins-core/tests/manifest.test.ts`
  - valid policy accepted
  - malformed policy rejected
  - invalid roles rejected

### 13.2 Policy Evaluation Utility (Web)
- [ ] Create `apps/web/lib/plugins/access-control.ts` with pure evaluator:
  - `evaluatePluginAccess(policy, context, pluginPath)`
  - deterministic first-match or specificity ordering
  - fail-closed on parsing/evaluation errors
- [ ] Add tests: `apps/web/tests/lib/plugins/access-control.test.ts`
  - role and entitlement allow/deny
  - fallback default behavior
  - malformed policy denies

### 13.3 Host Route Enforcement
- [ ] Update `apps/web/app/apps/[pluginId]/layout.tsx`
  - load manifest
  - compute policy context from verified user cookie (+ entitlements if available)
  - evaluate policy before rendering children
  - return explicit access denied UI on deny
- [ ] Keep `main-app` blocked on `/apps/*` as-is unless product decision changes
- [ ] Keep login redirect behavior; document current nested callback limitation

### 13.4 Audit and Observability
- [ ] Add audit event constants in `packages/shared/src/types/audit.ts`
  - `PLUGIN_UI_ACCESS_DENIED`
  - `PLUGIN_UI_POLICY_ERROR`
- [ ] Emit structured logs from host enforcement path in `apps/web/app/apps/[pluginId]/layout.tsx`
  - include `pluginId`, path, reasonCode
- [ ] If audit endpoint exists, forward denied/policy-error incidents to `/api/v1`

### 13.5 Entitlements at Host Time
- [ ] Decide host-evaluable entitlement source:
  - cookie claims, or
  - lightweight API call, or
  - server session lookup
- [ ] Implement chosen source in web layer before enabling strict `entitlementsAny` checks
- [ ] If source unavailable, keep deny-on-entitlement-rule (fail-closed)

### 13.6 Documentation
- [ ] Update plugin author docs:
  - `features-request/plugin-system-specs-v3.7/main-app-doc`
  - `features-request/plugin-system-specs-v3.7/plugins-doc.md`
  - include `accessControl` examples and migration notes
- [ ] Add one migration note in `features-request/plugin-system-specs-v3.7/implementation-deviations.md`
  - "plugins without `accessControl` default to `authenticated`"

### 13.7 Rollout Flags (Recommended)
- [ ] Add feature flag (example: `PLUGIN_UI_ACCESS_CONTROL_V1`)
- [ ] Stage rollout:
  - log-only mode
  - enforce mode
  - remove flag after stabilization
