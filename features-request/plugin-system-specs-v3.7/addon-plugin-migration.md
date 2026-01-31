# Addon Spec — Tier B Plugin Schema Migrations & Version Compatibility
**Production-safe plugin migrations, dev/CI friendly, zero runtime side effects, boot-time compatibility guarantees.**

## 0) Goal
Enable Tier B plugins to evolve their database schema over time (new plugin versions adding migrations) while ensuring:

- No plugin code runs against an incompatible schema
- Migration discovery is bundler-safe and side-effect-free
- pnpm strict resolution remains valid
- Dev mode and CI workflows are deterministic
- Downgrades are not required for safety (patch-forward + kill switch)

This spec does **not** allow plugins to run migrations at runtime in production.

---

## 1) Core Principles (non-negotiable)

1) **Migrations are applied via CLI only** (e.g., `node ace migration:run`).
2) **Boot must fail fast** if enabled plugin schema is behind expected version.
3) Migration discovery uses **static metadata**, never importing plugin TS entrypoints.
4) Plugin migrations are **append-only** (do not edit existing migrations once released).
5) Disabling a plugin **does not rollback** schema. Data remains.
6) The system is designed for **patch-forward** (disable plugin + hotfix), not downgrades.

---

## 2) Plugin Static Metadata Contract (`plugin.meta.json`)
Each Tier B plugin must ship a static metadata file (JSON), located at a stable path within the plugin package.

Recommended location:
- `plugins/<pluginId>/plugin.meta.json`

This file is used by:
- migration directory resolution
- schema compatibility checks
- optional CI validation

### 2.1 Required fields
```json
{
  "pluginId": "motion",
  "packageName": "@plugins/motion",
  "version": "1.3.0",
  "migrations": {
    "dir": "./database/migrations",
    "schemaVersion": 3
  }
}
```

Field rules:
- `pluginId` must match the plugin definition `name/id`
- `packageName` must be the workspace package name used in imports
- `migrations.dir` is a relative path **within the plugin package**
- `migrations.schemaVersion` is an integer and must be **monotonic increasing** across releases that change schema
- If a plugin has no DB schema, omit `migrations` entirely

### 2.2 Why JSON and not TS
- JSON is side-effect-free
- JSON can be loaded by Node without transpiling TS
- Avoids `ERR_PACKAGE_PATH_NOT_EXPORTED` traps and ts-node/node_modules issues

---

## 3) Core State Table: `plugin_db_state`
Core must track the applied schema version per plugin.

### 3.1 Table definition
`plugin_db_state`
- `plugin_id text primary key`
- `schema_version int not null default 0`
- `updated_at timestamptz not null default now()`

Optional (useful but not required):
- `installed_plugin_version text null`
- `last_migration_name text null`
- `last_migrated_at timestamptz null`

### 3.2 Semantics
- `schema_version` is the **highest schemaVersion fully applied** for that plugin.
- Core uses this value to verify compatibility at boot.

---

## 4) Migration Directory Discovery (side-effect-free)
Core must expose a resolver function that returns migration directories for all installed plugins.

### 4.1 Where this resolver lives (pnpm strict-safe)
Place resolution in the package that owns plugin dependencies (per your earlier “phantom dependency” fix):
- `@pkg/config` (compiled to JS in `dist/`)

The resolver:
- reads the list of installed plugins (static imports)
- loads each plugin’s `plugin.meta.json`
- resolves its absolute migrations dir

### 4.2 Critical rule
Do not import:
- `plugin/server.ts`
- `plugin/client.ts`
- `plugin/index.ts`

Only read static metadata.

---

## 5) Adonis Migration Runner Integration
Adonis must discover plugin migrations via directories.

You already have a pattern for adding:
- `plugins/*/database/migrations`

However, because you are treating plugins as workspace packages and want strict safety and control, use the resolver output to build the migration paths list.

### 5.1 `adonisrc.ts` integration shape
- `directories.migrations` includes core migrations + resolved plugin migration directories

Requirement:
- these directories must resolve to actual filesystem paths in the repo/container.

---

## 6) Boot-Time Compatibility Check (mandatory)
Core must refuse to start when:
- a plugin is enabled (server-side) and expects schemaVersion N
- but DB has schemaVersion < N

### 6.1 Inputs
For each enabled Tier B plugin:
- expected version: `plugin.meta.json` → `migrations.schemaVersion`
- actual version: `plugin_db_state.schema_version` for `plugin_id`

### 6.2 Failure behavior
On mismatch:
- write an audit/incident record (or at least a structured log)
- exit process (fatal)

Error message must include:
- pluginId
- expected schemaVersion
- actual schemaVersion
- remediation: “run node ace migration:run”

### 6.3 When to run the check
- after DB connection is ready
- before registering plugin hooks/routes
- before serving requests

---

## 7) How plugin migrations bump schema version (standardized)
You want a consistent way for plugin authors to bump `plugin_db_state` when migrations are complete.

### 7.1 Provide a core helper
Core exports a helper function usable from migrations:
- `setPluginSchemaVersion(pluginId, schemaVersion, trx)`

This prevents plugin authors from writing ad-hoc SQL.

### 7.2 Required pattern
- The final migration for a given plugin release that changes schema must bump the version.

Example:
- schemaVersion 3 release includes migrations:
  - 1690000000000_create_tables
  - 1690000000001_backfill
  - 1690000000002_constraints_and_bump_version  ← this one sets schemaVersion=3

### 7.3 Safety
This update must run inside the same migration transaction when possible.

---

## 8) Dev Workflow Expectations
### 8.1 When a plugin adds migrations
Developer must:
1) pull the new plugin version (or edit locally)
2) run `node ace migration:run`

Boot check ensures they can’t forget.

### 8.2 Local watch
No special watch required for schema changes.
Schema changes are applied via migration CLI.

---

## 9) CI / Release Workflow (recommended)
Add a CI gate:
1) Boot a fresh DB
2) Run `node ace migration:run`
3) Run a “plugin verify” command:
   - validates metas
   - validates schema versions
   - validates DB state

Optional command:
- `node ace plugins:verify`

---

## 10) Downgrades and Rollbacks (explicitly unsupported)
By default:
- downgrading plugin code to an older version while schema is ahead is not guaranteed safe
- you should patch-forward or keep plugin disabled until fixed

If you ever want downgrades:
- require explicit tested down migrations (out of scope)

---

## 11) Mandatory Plugin Author Rules (for migrations)
If your platform rules already exist, enforce them here too:

- migrations must create tenant-scoped tables (tenant_id)
- RLS policies must be set up for plugin tables
- naming prefixes to avoid collisions
- no side effects in metadata resolution
- no runtime “auto migrate” on boot

---

## 12) Implementation Order
1) Add `plugin_db_state` core migration
2) Add `plugin.meta.json` contract + validation
3) Build migration dirs resolver in `@pkg/config` (compiled)
4) Wire resolver output into Adonis migration directories
5) Implement boot-time compatibility check
6) Provide `setPluginSchemaVersion()` helper
7) Add CI “plugins:verify” command (optional but recommended)

---

End of addon spec.
