# Plugin Dependency Enforcement Spec
**Status:** Draft for implementation planning  
**Depends on:** `plugins-system-final.md`, `plugins-mandatory-rules.md`, `tier-c-platform-plugins-spec.md`

---

## 0) Purpose

Define enforceable behavior for plugin-to-plugin dependencies declared in `plugin.meta.json`:

```json
{
  "dependencies": ["files", "collab"]
}
```

This spec covers install/boot/enable/disable/uninstall behavior and failure semantics.

---

## 1) Scope and terms

- **Plugin dependency**: runtime dependency between plugin IDs declared in `manifest.dependencies`.
- **Installed**: plugin package is present in loader maps and registry.
- **Active**: plugin booted and not quarantined.
- **Enabled (tenant)**: plugin is enabled for a specific tenant in `plugin_states`.

Non-goal:
- This spec does not define cross-plugin service calls/facades. Dependencies only express lifecycle ordering and availability requirements.

---

## 2) Hard rules

1. A dependency target in `manifest.dependencies` MUST reference a known plugin ID.
2. Self-dependency is invalid.
3. Dependency graph cycles are invalid.
4. Dependency checks are fail-closed for the dependent plugin.
5. Dependents MUST NOT be usable when any required dependency is unavailable for that scope.

---

## 3) Validation and graph build

At plugin registration/verification time:

1. Read all manifests and build directed graph: `plugin -> dependency`.
2. Validate unknown targets and self-dependency.
3. Detect cycles using topological sort (Kahn/DFS).
4. If cycle exists, mark all cycle-involved plugins invalid (quarantine candidates) with explicit error messages.

Determinism:
- Topological ordering MUST be deterministic.
- Tie-break for same in-degree nodes: lexical sort by `pluginId`.

---

## 4) Boot-time behavior (deployment scope)

Boot order:
1. Register manifests.
2. Build dependency graph and topological order.
3. Boot plugins in topological order.

Rules:
1. If dependency plugin is missing/quarantined/not active, dependent plugin is quarantined.
2. Quarantine reason must include failing dependency IDs.
3. App boot continues; this is plugin-scoped failure, not process-fatal.

Transitive effect:
- If `A` depends on `B`, and `B` depends on `C`, failure in `C` quarantines `B`, then `A`.

---

## 5) Tenant enable/disable behavior (tenant scope)

### 5.1 Enable plugin

When enabling plugin `P` for tenant `T`:
1. Resolve all transitive dependencies of `P`.
2. Require each dependency to be enabled for `T`.
3. If any is disabled, reject with `409` and list missing dependencies.
4. Do not auto-enable dependencies by default.

### 5.2 Disable plugin

When disabling plugin `D` for tenant `T`:
1. Find all enabled dependents of `D` in tenant `T` (direct + transitive).
2. Disable them in the same transaction (cascade disable).
3. Return response listing cascaded plugin IDs.

### 5.3 Re-enable behavior

- Re-enabling a dependency does not auto-reenable dependents.
- Dependent enable remains explicit admin action.

---

## 6) Runtime request enforcement

For plugin routes/jobs of plugin `P`:
1. Runtime must confirm all dependencies of `P` are active (deployment scope) and enabled for the current tenant (tenant scope when applicable).
2. If dependency contract is violated at runtime, reject request with `503 PluginDependencyUnavailable`.

This is a defense-in-depth check; primary guarantees come from boot + enable/disable flow.

---

## 7) Uninstall behavior

Uninstalling plugin `X`:
1. If other installed plugins depend on `X`, uninstall is blocked by default.
2. Optional forced uninstall mode may be allowed only with explicit cascade plan:
   - disable dependents for all tenants,
   - uninstall dependents first,
   - then uninstall `X`.

---

## 8) Audit and observability

Minimum audit events:
1. `plugin.dependency.enable_blocked`
2. `plugin.dependency.cascade_disabled`
3. `plugin.dependency.boot_quarantine`

Minimum metrics:
1. Count of dependency-blocked enables.
2. Count of cascade disables.
3. Count of dependency-caused quarantines.

---

## 9) API/error contract

Suggested errors:

```json
{
  "error": "PluginDependencyError",
  "message": "Plugin \"collab\" requires dependencies that are not enabled",
  "errors": ["files"]
}
```

```json
{
  "error": "PluginDependencyUnavailable",
  "message": "Dependency \"files\" for plugin \"collab\" is unavailable"
}
```

---

## 10) Attachment plugin example

If `collab` declares:

```json
{ "dependencies": ["files"] }
```

Then:
1. `collab` cannot boot active if `files` is missing/quarantined.
2. Tenant cannot enable `collab` unless `files` is enabled for that tenant.
3. Disabling `files` cascades disable to `collab` for that tenant.
4. Direct API calls to collab attachment endpoints must still fail when dependency is unavailable.

---

## 11) Implementation checklist

1. Add dependency graph validation in plugin registration/verify command.
2. Add deterministic topological boot ordering in boot service.
3. Add dependency checks to tenant plugin enable/disable flows with cascade disable.
4. Add runtime dependency guard in plugin enforcement middleware.
5. Add audit/metrics hooks.
6. Add tests:
   - cycle detection,
   - missing dependency quarantine,
   - enable blocked,
   - cascade disable,
   - runtime guard failure.

---

End of document.
