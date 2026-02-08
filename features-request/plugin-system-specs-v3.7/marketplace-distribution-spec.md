# Spec — Plugin Marketplace & Distribution (Model 3: Private Registry + License Key)

**Stack:** Next.js (App Router) + AdonisJS + Postgres (Supabase) + pnpm strict monorepo
**Depends on:** `plugins-system-final.md`, `plugins-mandatory-rules.md`, `feature-gating.md`, `enterprise-feature-control-plane-spec.md`

---

## 0) Purpose & Context

This spec defines how plugins are **distributed**, **installed**, and **license-gated** outside of the main SaaS monorepo.

It introduces:
- A **tiered access model** (bundled / marketplace / premium)
- A **private npm registry** (GitHub Packages) for marketplace plugin distribution
- A **license key system** for runtime entitlement enforcement at boot
- A **marketplace monorepo** (separate private GitHub repo) for all non-bundled plugins
- A **public SDK** (`@saas/plugins-core`, `@saas/shared`) published to npm for external plugin development

### Design constraints (from existing specs)

The following constraints are **non-negotiable** and this spec works within them:
- Plugins are **installed statically** via loader maps in `@saas/config` (mandatory rules 1.1)
- **No runtime filesystem scanning** (`fs.readdir`, globbing) (mandatory rules 1.1)
- **No dynamic string imports** — all imports are static in `plugins.config.ts` (spec section 4)
- Plugins are **enabled dynamically** via kill switch / capability system (mandatory rules 1.1)
- `@saas/config` must **explicitly declare** every installed plugin as a dependency (mandatory rules 2.1)
- Plugin boot failures are **fail-closed** (plugin disabled, app continues) (mandatory rules 1.2)

---

## 1) Tiered Access Model

### 1.1 Three access tiers

| Tier | Where it lives | Gate 1: Code access | Gate 2: Runtime enforcement |
|------|---------------|--------------------|-----------------------------|
| **Bundled** | Main repo (`plugins/`) | Always (workspace package) | Always enabled |
| **Marketplace** | Marketplace repo (private) | npm token (marketplace subscription) | License key: `marketplace: true` |
| **Premium** | Marketplace repo (private) | Same npm token | License key: `pluginId` in entitlements |

Note: plugin implementation tier (A/B/C) and access tier (`bundled`/`marketplace`/`premium`) are orthogonal.

### 1.2 Access tiers are additive

- Paying for "marketplace access" grants code access to **all** plugins in the marketplace repo (both marketplace and premium).
- Premium plugins are **additional paid entitlements** on top of marketplace access.
- A marketplace subscriber can `pnpm add` a premium plugin (they have the token), but it **fails closed at boot** if their license key does not include that plugin.

### 1.3 Manifest declaration

The `plugin.meta.json` manifest gains an `access` field:

```json
{
  "pluginId": "analytics",
  "packageName": "@saas-premium/analytics",
  "version": "1.0.0",
  "tier": "B",
  "access": "premium",
  "displayName": "Analytics",
  "description": "SaaS KPI tracking: DAU/MAU, MRR/ARR, Churn, LTV, ARPU",
  "requestedCapabilities": [...]
}
```

Valid `access` values:
- `"bundled"` — Ships with the main repo. No license check.
- `"marketplace"` — Free with marketplace subscription. License key must include `marketplace: true`.
- `"premium"` — Requires per-plugin entitlement. License key must list this `pluginId`.

**Default:** If `access` is omitted, it defaults to `"bundled"` (backward compatible with existing plugins).

### 1.4 Manifest type update

Add to `PluginManifest` in `@saas/plugins-core`:

```ts
export type PluginAccessTier = 'bundled' | 'marketplace' | 'premium'

export interface PluginManifest {
  // ... existing fields ...

  /**
   * Access tier for distribution and licensing.
   * - 'bundled': Ships with core, always available.
   * - 'marketplace': Free with marketplace subscription.
   * - 'premium': Requires per-plugin license entitlement.
   * Defaults to 'bundled' if omitted.
   */
  access?: PluginAccessTier
}
```

---

## 2) Repository Architecture

### 2.1 Two repos

```
saas/                              (main repo — private)
  apps/api/
  apps/web/
  packages/
    plugins-core/                  → published to npm (public)
    shared/                        → published to npm (public)
    config/                        → NOT published (monorepo-internal)
  plugins/
    main-app/                      → bundled (workspace:*)
    nav-links/                     → bundled (workspace:*)
    notes/                         → bundled (workspace:*)

saas-marketplace/                  (marketplace repo — private)
  plugins/
    analytics/                     → published to GitHub Packages (private)
    crm/                           → published to GitHub Packages (private)
    helpdesk/                      → published to GitHub Packages (private)
    ...
  templates/
    tier-a-template/               → starter template for new Tier A plugins
    tier-b-template/               → starter template for new Tier B plugins
```

### 2.2 Bundled plugins stay in main repo

Bundled plugins (`main-app`, `nav-links`, `notes`) remain as `workspace:*` packages in the main repo:
- They are core functionality.
- They use `"access": "bundled"` (or omit `access`).
- No license check required.
- No npm publishing required.

### 2.3 Marketplace monorepo

The `saas-marketplace` repo is a **private GitHub repository** containing:
- All marketplace and premium plugins as pnpm workspace packages under `plugins/`.
- Shared CI/CD for building, testing, and publishing all plugins.
- Starter templates for new plugins.
- Plugin development tooling (linting, manifest validation, etc.).

Each plugin in the marketplace repo:
- Is its own pnpm workspace package.
- Depends on `@saas/plugins-core` and `@saas/shared` from **public npm** (not `workspace:*`).
- Is published individually to GitHub Packages under the `@saas-premium` scope.

### 2.4 Package naming convention

| Location | Scope | Example |
|----------|-------|---------|
| Main repo (bundled) | `@plugins/*` | `@plugins/notes` |
| Marketplace repo | `@saas-premium/*` | `@saas-premium/analytics` |

The scope change is intentional:
- `@plugins/*` = internal workspace packages (never published).
- `@saas-premium/*` = published to GitHub Packages (private registry).

### 2.5 Marketplace repo `pnpm-workspace.yaml`

```yaml
packages:
  - 'plugins/*'
```

### 2.6 Marketplace plugin `package.json` example

```json
{
  "name": "@saas-premium/analytics",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/server.js",
  "types": "./dist/server.d.ts",
  "exports": {
    ".": {
      "types": "./dist/server.d.ts",
      "default": "./dist/server.js"
    },
    "./plugin.meta.json": "./plugin.meta.json",
    "./types": {
      "types": "./dist/types.d.ts",
      "default": "./dist/types.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "default": "./dist/client.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@saas/plugins-core": "^1.0.0",
    "@saas/shared": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

Key difference from bundled plugins: `@saas/plugins-core` and `@saas/shared` use **semver ranges** (not `workspace:*`).

---

## 3) Public SDK (npm-published packages)

### 3.1 Packages to publish

Two packages must be published to **public npm** so external plugins can depend on them:

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/plugins-core` | `@saas/plugins-core` | Plugin contract: types, manifest, hooks registry, facades, enforcement |
| `packages/shared` | `@saas/shared` | Shared TypeScript types (DTOs, enums, etc.) |

### 3.2 Versioning strategy

- Use **semantic versioning** strictly.
- Breaking changes to plugin contracts (manifest shape, hook signatures, facade APIs) bump the **major** version.
- New capabilities, new hook names, new optional manifest fields bump the **minor** version.
- Bug fixes bump the **patch** version.
- Marketplace plugins declare `@saas/plugins-core` as a **peer dependency** or **dependency** with a compatible range (e.g., `^1.0.0`).

### 3.3 Publishing CI

The main repo CI publishes `@saas/plugins-core` and `@saas/shared` to npm on tagged releases:

```yaml
# .github/workflows/publish-sdk.yml (main repo)
on:
  push:
    tags:
      - 'plugins-core-v*'
      - 'shared-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @saas/plugins-core build
      - run: pnpm --filter @saas/plugins-core publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3.4 What is NOT published

- `@saas/config` — monorepo-internal, contains static loader maps specific to deployment.
- `@plugins/*` — bundled workspace plugins, not published.
- `apps/api`, `apps/web` — applications, not libraries.

---

## 4) Private Registry (GitHub Packages)

### 4.1 Why GitHub Packages

- Already using GitHub for repo hosting.
- Private npm hosting included with private repos.
- Auth via GitHub tokens (PAT or fine-grained).
- No additional infra to manage.
- Migration to Verdaccio later is trivial (registry URL + token swap in `.npmrc`).

### 4.2 Registry configuration

Marketplace plugins are published under the `@saas-premium` scope to GitHub Packages.

**Marketplace repo `.npmrc`** (for publishing):
```ini
@saas-premium:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**Customer project `.npmrc`** (for consuming):
```ini
@saas-premium:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${MARKETPLACE_NPM_TOKEN}
```

### 4.3 Token issuance

When a customer purchases a marketplace subscription:
1. A **read-only** GitHub fine-grained PAT is generated (or a classic PAT with `read:packages` scope).
2. The token is scoped to the `saas-marketplace` repo only.
3. The token is delivered to the customer via a secure channel (dashboard, email).
4. Customer adds it to their `.npmrc` (one-time setup).

### 4.4 Token revocation

When a customer's marketplace subscription lapses:
1. The GitHub PAT is revoked (or the customer is removed from the org).
2. `pnpm install` fails for `@saas-premium/*` packages — they can no longer update.
3. Already-installed code continues to work locally (it's in `node_modules`).
4. Gate 2 (license key) prevents the plugin from running even with stale code.

### 4.5 Publishing CI (marketplace repo)

```yaml
# .github/workflows/publish-plugins.yml (marketplace repo)
on:
  push:
    tags:
      - '*-v*'  # e.g., analytics-v1.2.0

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter "@saas-premium/${PLUGIN_NAME}" build
      - run: pnpm --filter "@saas-premium/${PLUGIN_NAME}" publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4.6 Future migration to Verdaccio

If needed, the migration consists of:
1. Set up Verdaccio server (Docker container, ~30 min).
2. Republish all packages to the new registry.
3. Update marketplace repo `.npmrc` (publish target).
4. Notify customers to update their `.npmrc` (registry URL + new token).
5. Zero changes to plugin source code, `plugins.config.ts`, or main repo.

---

## 5) License Key System (Gate 2 — Runtime Enforcement)

### 5.1 Purpose

Even if someone has the npm token (Gate 1), the license key prevents unauthorized runtime use:
- Expired subscriptions.
- Leaked npm tokens.
- Downgraded plans.
- Attempting to use premium plugins without purchasing them.

### 5.2 License key format

License keys are opaque strings stored in the deployment environment:

```env
SAAS_LICENSE_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5.3 License key payload (what the licensing API returns)

When validated, a license key resolves to an **entitlements payload**:

```ts
interface LicenseEntitlements {
  /** License key ID (for audit) */
  licenseId: string

  /** Customer identifier */
  customerId: string

  /** License status */
  status: 'active' | 'expired' | 'suspended'

  /** Marketplace access granted */
  marketplace: boolean

  /** Set of premium plugin IDs the customer is entitled to */
  premiumPlugins: string[]

  /** Expiry timestamp (ISO 8601) */
  expiresAt: string

  /** Timestamp of this validation */
  validatedAt: string
}
```

### 5.4 Validation flow

At boot time, the plugin loader:

1. Reads `SAAS_LICENSE_KEY` from environment.
2. For each plugin with `access: "marketplace"` or `access: "premium"`:
   a. If no license key → **fail closed** (plugin quarantined, app continues).
   b. Call licensing API: `POST https://license.yourdomain.com/v1/validate`
   c. Cache response for `cacheTTL` (default: 1 hour).
   d. Check entitlements:
      - `access: "marketplace"` → requires `entitlements.marketplace === true`
      - `access: "premium"` → requires `entitlements.premiumPlugins.includes(pluginId)`
   e. If not entitled → **fail closed**.
   f. If entitled → continue plugin boot normally.

### 5.5 Offline fallback

To avoid boot failures when the licensing API is unreachable:

- Cache the last successful validation response to disk (`~/.saas-license-cache.json`).
- On API timeout/failure, use cached response if it's less than `offlineGracePeriod` old (default: 7 days).
- If cache is stale or missing AND API is unreachable → **fail closed**.
- Log a warning when using cached entitlements.

### 5.6 License validation API contract

```
POST /v1/validate
Content-Type: application/json

{
  "licenseKey": "sk_live_xxx",
  "deploymentId": "dep_xxx",        // optional: for analytics
  "requestedPlugins": ["analytics"]  // optional: for audit
}

→ 200 OK
{
  "data": {
    "licenseId": "lic_xxx",
    "customerId": "cust_xxx",
    "status": "active",
    "marketplace": true,
    "premiumPlugins": ["analytics", "crm"],
    "expiresAt": "2027-02-06T00:00:00Z",
    "validatedAt": "2026-02-06T15:30:00Z"
  }
}

→ 401 Unauthorized (invalid key)
→ 403 Forbidden (suspended)
→ 429 Rate Limited
```

### 5.7 Boot-time integration

The license check integrates into the existing plugin boot sequence:

```
1. Load plugin manifests (existing)
2. Validate manifest fields (existing)
3. ── NEW: License entitlement check ──
   For each plugin where access !== "bundled":
     a. Validate license key against licensing API (or cache)
     b. Check entitlements for this plugin
     c. If not entitled → set plugin status = "quarantined"
        with errorMessage = "License does not include this plugin"
     d. If entitled → continue
4. Check capabilities (existing)
5. Boot plugin (existing)
```

This uses the existing `PluginStatus` = `'quarantined'` state and fail-closed behavior, fully consistent with the plugin system spec.

### 5.8 No license check for bundled plugins

Bundled plugins (`access: "bundled"` or `access` omitted) skip the license check entirely. This is the default and ensures backward compatibility with all existing plugins.

---

## 6) Installation Flow (Customer Perspective)

### 6.1 One-time setup

```bash
# 1. Configure private registry access
echo "@saas-premium:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_MARKETPLACE_TOKEN" >> .npmrc

# 2. Add license key to environment
echo "SAAS_LICENSE_KEY=sk_live_xxx" >> apps/api/.env
```

### 6.2 Installing a marketplace plugin

This is a **code change** (spec-compliant: "installed statically"):

```bash
# 1. Install the package
pnpm --filter @saas/config add @saas-premium/analytics

# 2. Add to static loader map (plugins.config.ts)
# 3. Add type import (plugins.types.d.ts)
# 4. Build and deploy
```

### 6.3 Changes to `plugins.config.ts`

Adding a marketplace plugin to the static loader map:

```ts
export const ADDITIONAL_PLUGINS: Record<string, PluginConfig> = {
  // ... existing bundled plugins ...

  // Marketplace plugins (installed from @saas-premium)
  analytics: {
    id: 'analytics',
    packageName: '@saas-premium/analytics',
    serverImport: () => import('@saas-premium/analytics'),
    clientImport: () => import('@saas-premium/analytics/client'),
    manifestImport: () => import('@saas-premium/analytics/plugin.meta.json'),
  },
}
```

### 6.4 Changes to `plugins.types.d.ts`

```ts
// Marketplace plugin types
import '@saas-premium/analytics/types'
```

### 6.5 Spec compliance verification

| Spec rule | How it's satisfied |
|-----------|-------------------|
| Static loader map (mandatory rules 1.1) | Plugin added to `plugins.config.ts` |
| No runtime fs scanning (mandatory rules 1.1) | Static imports, no `fs.readdir` |
| `@saas/config` declares dependency (mandatory rules 2.1) | `pnpm add` adds to `package.json` |
| No phantom deps (mandatory rules 2.2) | Direct dependency in `@saas/config` |
| Server entry resolves to JS (mandatory rules 2.2) | Plugin built to `dist/` before publish |
| Fail closed on denied capabilities (mandatory rules 1.2) | License check → quarantine on failure |
| Exports-safe metadata (mandatory rules 2.3) | `./plugin.meta.json` exported |
| Type augmentation (mandatory rules 3.2) | `./types` exported and imported |

---

## 7) Changes to `@saas/config` (Server Plugin Loader)

### 7.1 Manifest loading must support npm packages

The current `plugins.server.ts` uses `loadJsonManifest()` which reads from the filesystem path `plugins/{pluginId}/plugin.meta.json`. This works for workspace plugins but **not** for npm-installed plugins (which live in `node_modules`).

**Solution:** Use the existing `manifestImport` from `plugins.config.ts` (which uses static `import()`) instead of the filesystem-based `loadJsonManifest()`. The client loader (`plugins.client.ts`) already does this correctly.

The `serverPluginManifests` map should use:

```ts
export const serverPluginManifests: Record<string, ManifestLoader> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [
    id,
    async () => {
      const imported = await config.manifestImport()
      return extractManifest(imported)
    },
  ])
)
```

This is the same pattern as `clientPluginManifests` and works regardless of whether the plugin is a workspace package or an npm package.

### 7.2 Migration path resolution

The current `plugins.migrations.ts` may resolve migration directories relative to the monorepo root. For npm-installed plugins, migration files are inside `node_modules/@saas-premium/analytics/database/migrations/`.

**Solution:** Resolve migration directories using `require.resolve` or `import.meta.resolve` from the plugin's `package.json`, not from a hardcoded monorepo path.

---

## 8) Marketplace Repo Structure

### 8.1 Directory layout

```
saas-marketplace/
  .github/
    workflows/
      publish.yml               # CI: build + publish on tag
      test.yml                  # CI: test all plugins
      validate-manifests.yml    # CI: validate plugin.meta.json files
  .npmrc                        # Registry config for publishing
  pnpm-workspace.yaml           # plugins/*
  package.json                  # Root: shared scripts, devDeps
  tsconfig.base.json            # Shared TS config
  plugins/
    analytics/
      src/
        server.ts
        client.ts
        types.ts
      database/
        migrations/
      plugin.meta.json
      package.json
      tsconfig.json
    crm/
      ...
  templates/
    tier-a/                     # Starter template for Tier A plugins
    tier-b/                     # Starter template for Tier B plugins
  docs/
    PLUGIN_AUTHOR_GUIDE.md      # Link to main spec docs
    CONTRIBUTING.md
```

### 8.2 Root `package.json`

```json
{
  "name": "@saas-marketplace/root",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "validate": "pnpm -r validate:manifest",
    "new:plugin": "node scripts/create-plugin.mjs"
  },
  "devDependencies": {
    "@saas/plugins-core": "^1.0.0",
    "typescript": "^5.6.3"
  }
}
```

### 8.3 CI manifest validation

Every PR and push should validate all `plugin.meta.json` files using `validatePluginManifest()` from `@saas/plugins-core`. This catches:
- Missing required fields
- Invalid access tiers
- Table prefix violations
- Route namespace violations
- Tier A plugins declaring Tier B features
- Tier A/B manifests requesting `core:*` capabilities
- Missing `core:hooks:define` when `definedHooks` or `definedFilters` are present
- Invalid Tier C hook/filter namespace (`{pluginId}:*`)
- Explicit `authzNamespace` on Tier C manifests (must be derived)

---

## 9) Security Considerations

### 9.1 Defense in depth (two independent gates)

| Threat | Gate 1 (npm token) | Gate 2 (license key) |
|--------|--------------------|-----------------------|
| Unauthorized code access | Blocks `pnpm add` | N/A |
| Leaked npm token | N/A | Blocks boot without valid license |
| Expired subscription | Token revoked | License expired → quarantine |
| Downgraded plan | N/A | Premium plugin not in entitlements → quarantine |
| Copied code from another customer | N/A | License key tied to customer → mismatch |

### 9.2 License key security

- License keys are environment secrets (`SAAS_LICENSE_KEY`). They must NOT be committed to version control.
- License validation API uses HTTPS.
- License cache file should be excluded from version control (`.gitignore`).
- License keys should be rotatable (customer can request a new key from the dashboard).

### 9.3 Plugin code integrity

Marketplace plugins are published by the SaaS vendor (you). Customers cannot publish to the `@saas-premium` scope. This prevents supply chain attacks from third parties.

If third-party plugin contributions are accepted in the future, they must go through code review in the marketplace repo before being published.

### 9.4 No license bypass via manifest tampering

The license check reads `access` from the manifest's `plugin.meta.json`. A malicious actor could theoretically modify the manifest in `node_modules` to change `"access": "premium"` to `"access": "bundled"`.

**Mitigation options (pick one, recommend option A):**
- **A) Integrity hash in license entitlements:** The licensing API returns expected manifest hashes. Boot-time check compares.
- **B) Server-side plugin registry:** The licensing API knows which plugins are premium. The check is based on `pluginId` matching a server-side list, not the local manifest.
- **C) Accept the risk:** The customer is self-hosting. If they tamper with their own deployment, they violate ToS. This is the same trust model as most enterprise software.

### 9.5 Existing spec constraints are preserved

All existing security rules from `plugins-mandatory-rules.md` remain in force:
- RLS + tenant isolation
- Capability enforcement
- Namespace scoping
- Fail-closed boot
- No open context

The marketplace distribution model does not weaken any of these guarantees.

---

## 10) Versioning & Compatibility

### 10.1 SDK compatibility matrix

Marketplace plugins depend on `@saas/plugins-core` with a semver range. The main repo also uses `@saas/plugins-core` (as a workspace package in development).

**Rule:** The version of `@saas/plugins-core` in the main repo must be **greater than or equal to** the version any installed marketplace plugin requires.

Example:
- Main repo has `@saas/plugins-core@1.3.0` (workspace).
- Marketplace plugin requires `@saas/plugins-core@^1.2.0` → Compatible.
- Marketplace plugin requires `@saas/plugins-core@^2.0.0` → **Incompatible** (pnpm install fails with peer dep warning/error).

### 10.2 Plugin version pinning

Customers control which version of marketplace plugins they install:
- `pnpm add @saas-premium/analytics@^1.0.0` → auto-update within semver range.
- `pnpm add @saas-premium/analytics@1.2.3` → pin exact version.

### 10.3 Breaking changes communication

When a new major version of `@saas/plugins-core` is published:
1. Update all marketplace plugins to use the new version.
2. Publish new major versions of marketplace plugins.
3. Document migration guide for customers.
4. Old plugin versions continue to work with old SDK versions (semver guarantees).

---

## 11) Implementation Order

### Phase 1: SDK publishing
1. Add npm publish CI to main repo for `@saas/plugins-core` and `@saas/shared`.
2. Tag and publish `@saas/plugins-core@1.0.0` and `@saas/shared@1.0.0` to npm (public).
3. Add `access` field to `PluginManifest` type (optional, defaults to `"bundled"`).
4. Add `access` field validation to `validatePluginManifest()`.

### Phase 2: Marketplace repo
5. Create `saas-marketplace` private GitHub repo.
6. Set up pnpm workspace, tsconfig, CI.
7. Move `plugins/analytics` from main repo to marketplace repo.
8. Update `package.json` to depend on `@saas/plugins-core@^1.0.0` (from npm).
9. Set up GitHub Packages publishing CI.
10. Publish `@saas-premium/analytics@1.0.0`.

### Phase 3: Main repo consumption
11. Fix `plugins.server.ts` manifest loading to use `manifestImport` (not filesystem path).
12. Fix migration path resolution for npm-installed plugins.
13. Configure `.npmrc` in main repo for `@saas-premium` scope.
14. Replace `@plugins/analytics` (workspace) with `@saas-premium/analytics` (npm) in `@saas/config`.
15. Update `plugins.config.ts` imports.
16. Verify build + boot with npm-installed plugin.

### Phase 4: License system
17. Build licensing API (`POST /v1/validate`).
18. Implement license key validation in plugin loader (boot-time check).
19. Implement offline cache fallback.
20. Add `SAAS_LICENSE_KEY` to `.env.example`.
21. Test: marketplace plugin without license key → quarantined.
22. Test: premium plugin without entitlement → quarantined.
23. Test: valid license → plugin boots normally.

### Phase 5: Customer onboarding
24. Document customer installation flow.
25. Build token issuance in customer dashboard.
26. Build license key management in customer dashboard.

---

## 12) Open Questions (to resolve before implementation)

1. **Licensing API hosting:** Self-hosted microservice vs. third-party licensing service (e.g., Keygen, LemonSqueezy)?
2. **Token delivery:** Automated via customer dashboard, or manual via support?
3. **Offline grace period:** 7 days default — is this acceptable for all deployment types?
4. **Manifest tampering mitigation:** Option A (integrity hash), B (server-side registry), or C (accept risk)?
5. **Third-party plugin contributions:** Will the marketplace accept external contributions in the future? If so, what's the review/trust model?

---

End of spec.
