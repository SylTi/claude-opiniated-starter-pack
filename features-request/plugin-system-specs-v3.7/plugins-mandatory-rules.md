# Plugin Mandatory Rules
**Security-first invariants for plugin authors and core reviewers**

This document is the **non-negotiable rulebook** for:
- Tier A/B plugins (UI + App plugins)
- Type 1 Enterprise Providers (tightly controlled provider modules)

If a plugin violates any **MUST** rule below, it is a **merge blocker**.

Design intent: a plugin must not be able to **accidentally** (or casually) bypass:
- tenancy isolation
- Row Level Security (RLS)
- RBAC/capabilities
- auditability

---

## 0) Vocabulary

- **Tenant is mandatory**: every request runs with a `tenant_id` in DB session context.
- **RLS context**: `SET LOCAL app.tenant_id` and `SET LOCAL app.user_id` are set inside the request transaction.
- **Tier A**: UI-only (filters/slots). No server routes, no DB schema.
- **Tier B**: App plugin (namespaced UI + namespaced API routes + optional DB tables).
- **Type 1 Enterprise Provider**: a core-owned contract implementation (SSO provider, audit sink, key provider, etc.).

---

## 1) Absolute rules (applies to all plugins)

### 1.1 Plugins are *installed statically* and *enabled dynamically*
- **MUST** be installed via a **static loader map** in `@pkg/config`.
- **MUST NOT** rely on runtime filesystem scanning (`fs.readdir`, globbing plugin folders at runtime).
- **MUST** support runtime enable/disable through the plugin state system (kill switch pattern).

### 1.2 Capabilities are mandatory
- A plugin **MUST** declare `requestedCapabilities` in `plugin.meta.json`.
- A plugin **MUST NOT** perform privileged actions unless core grants the capability.
- If a capability is missing/denied, plugin boot **MUST fail closed** (plugin disabled) without crashing the app.

### 1.3 No open context / no raw core bypass
- Server plugins **MUST NOT** receive raw `db`, raw `router`, raw `bouncer`, raw `drive` objects.
- Plugins **MUST** use core facades/registrars that enforce:
  - capability checks
  - namespace scoping
  - tenant scoping
  - audit logging where appropriate

### 1.4 Determinism & failure isolation
- Hook execution order **MUST** be deterministic: `(priority asc, registrationOrder asc)`.
- A plugin failure **MUST NOT** crash the request or break other plugins.
- Long-running hooks **SHOULD** have timeouts (especially Tier B).
- Plugin boot **MUST** be isolated: if a plugin throws on boot, it is marked failed/quarantined and execution continues.


### 1.5 Data egress, secrets, and privacy
- Client plugins **MUST NOT** access server secrets (KMS keys, DB credentials, service tokens).
- Any outbound network call to third-party services **MUST** be:
  - declared in metadata (domains/hosts),
  - capability-gated,
  - and routed through a core-owned HTTP client that logs destination + purpose (audit-friendly).
- Plugins **MUST NOT** exfiltrate tenant/user data off-platform unless:
  - the admin explicitly enables the feature,
  - the capability is granted (e.g., `enterprise.audit.sink` / `enterprise.backup.provider`),
  - and the data flow is documented and audited.

### 1.6 Hook semantics (Actions vs Filters)
- **Actions** may perform side effects. They **SHOULD** be idempotent (or tolerate duplicate delivery).
- **Filters** must behave like pure transformations:
  - **MUST** return the same logical type/shape as the input contract,
  - **MUST NOT** mutate the input object in-place (treat as immutable),
  - **MUST NOT** perform network calls unless capability-gated and explicitly allowed by the contract.
- Hooks **SHOULD** be fast; long-running work should be offloaded to jobs.

### 1.7 Versioning and migrations
- Plugin `id` is stable forever. Renaming a plugin is a breaking change and requires a migration plan.
- Migrations are append-only:
  - **MUST NOT** rewrite published migration files.
  - Schema changes **MUST** be done via new migrations.
- Disabling a plugin **MUST NOT** drop tables or destroy data. “Uninstall” is a separate, explicit operation.


---

## 2) Packaging & build rules (monorepo + production correctness)

### 2.1 Workspace package requirements (pnpm strict)
- Every plugin is a **workspace package** under `plugins/*`.
- If `@pkg/config` imports a plugin, then `@pkg/config` **MUST** list it as a dependency.
- Apps (`apps/api`, `apps/web`) **MUST NOT** rely on transitive plugin dependencies (no phantom deps).

### 2.2 Production cannot execute TypeScript from node_modules
- Any module imported by Node at runtime **MUST** resolve to JS in `dist/`.
- Server entrypoints **MUST** be exported as `./dist/*.js`.
- `package.json#exports` **MUST** point server/runtime imports to JS.

### 2.3 Exports-safe metadata
- Plugins **MUST** export `./plugin.meta.json` via `exports`.
- Plugins **MUST NOT** require importing TS modules just to read static metadata (no boot side-effects for migrations).

### 2.4 Naming & table prefixes
- Plugin tables **MUST** use a unique prefix: `plugin_<pluginId>_*`.
- Migrations **MUST** be deterministic and idempotent-friendly (avoid non-deterministic runtime imports).

---

## 3) Discovery, loader maps, and type safety

### 3.1 Loader map only
- Plugins are discovered only through `@pkg/config`:
  - `plugins.server.ts` manifest + loader map
  - `plugins.client.ts` manifest + loader map

### 3.2 Type augmentation must never be “ghosted”
- Each plugin that augments hook types **MUST** export a `./types` entry.
- `@pkg/config/plugins.types.d.ts` **MUST** import all plugin `./types` exports.
- Both apps **MUST** import `@pkg/config/plugins.types` (once) so TypeScript sees augmentations.

**Rule:** if hook names degrade to `never`, the build must fail in CI.

---

## 4) Routing & UI boundaries

> **Implementation Note:** Our API uses versioned routes: `/api/v1/apps/<pluginId>/...`
> See `implementation-deviations.md` for rationale.

### 4.1 Namespaced routing only (Tier B)
- Server routes registered by plugins **MUST** be under:
  - `/api/v1/apps/<pluginId>/...` *(adapted to include API versioning)*
- Plugins **MUST NOT** register/override core routes.
- Route registration **MUST** use a core `RoutesRegistrar` facade that enforces namespace + middleware defaults.

### 4.2 Next.js pages are hosted, not registered
- Plugins **MUST NOT** attempt to register Next.js routes dynamically.
- Plugin pages **MUST** render through the core host route:
  - `/apps/[pluginId]/[[...path]]`

### 4.3 Client request interception is NOT global
- Plugins **MUST NOT** register global "intercept all fetch requests" hooks.
- Any request transformation **MUST** be explicitly scoped:
  - only plugin namespace (`/api/v1/apps/<pluginId>`) OR
  - explicit core-owned security flow with consent + capability.

---

## 5) Enterprise Providers (Type 1) rules

These are *not* general plugins. They are contract implementations invoked by core.

- Providers **MUST** be registered via provider registries (not ad-hoc hooks).
- Providers **MUST** be capability-gated and tenant-configurable.
- Providers **MUST** be deterministic and side-effect bounded.

Examples of provider categories:
- `KeyProvider` (server-managed vs BYOK)
- `AuditSink`
- `SSOProvider`
- `BackupProvider`
- `DlpRedactor`

---

## 6) Tenancy + RLS are mandatory (DB safety contract)

### 6.1 Tenant is mandatory (no exceptions by default)
- Every authenticated request must have a `tenant_id` resolved by core.
- Every non-global domain row must be tenant-scoped.
- **Default position:** plugin tables are tenant-scoped.

### 6.2 “Global tables” require explicit approval
A plugin may create a global table **only if** all conditions are met:
1. The plugin declares it in metadata (`plugin.meta.json`):
   - `"globalTables": ["plugin_xxx_global_settings"]`
2. The plugin is approved for a high-trust capability.
3. The table is added to a core allowlist (reviewed in code).

If any are missing: **security defect**.

---

## 7) Mandatory invariants for any tenant-scoped plugin table

> **Implementation Note:** Our schema uses `integer` IDs instead of `uuid`.
> See `implementation-deviations.md` for rationale. Replace `::uuid` with `::integer` in all examples below.

For a table named `T`:

### 7.1 Required columns and constraints
- `tenant_id integer NOT NULL` *(adapted from uuid to match existing schema)*
- Foreign key:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT` (or CASCADE if your domain requires it)
- Index:
  - at least one index starting with `tenant_id` (e.g., `(tenant_id, created_at)`)

### 7.2 Recommended default
To reduce “developer forgot to set tenant_id” bugs:
- `tenant_id DEFAULT current_setting('app.tenant_id')::uuid`

This default is only safe if all request queries run inside the request transaction where core has already set `SET LOCAL app.tenant_id`.

### 7.3 RLS must be enabled and forced
- `ALTER TABLE T ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE T FORCE ROW LEVEL SECURITY;`

### 7.4 Policies must exist
At minimum:
- SELECT policy
- INSERT policy
- UPDATE policy
- DELETE policy

Each policy must include the tenant predicate:
- `tenant_id = current_setting('app.tenant_id')::uuid`

If your app requires membership checks, policies should also include:
- `app.is_tenant_member(current_setting('app.user_id')::uuid, tenant_id)`

---

## 8) Enforcement strategy (how we prevent mistakes)

**We do not rely on developers remembering rules.** We enforce them in layers:

1) **Migration-time hard fail** (primary)
- Migrations must call:
  - `app.apply_tenant_rls(T)`
  - `app.assert_tenant_scoped_table(T)`
- If a plugin forgets `tenant_id` or policies: migration fails.

2) **Database defaults + RLS policies** (secondary)
- Default tenant_id reduces footguns.
- RLS policies enforce tenant correctness even if app code tries to set a different tenant_id.

3) **CI schema audit** (backstop)
- CI runs a query against `pg_catalog` to ensure no tenant-scoped tables violate invariants.

---

## 9) Reference implementation (PostgreSQL)

Place these SQL helpers in **core migrations** (core-owned, not plugins).
Namespace them under `app.` to avoid collisions.

> Note: these are examples. You may tighten checks, but **fail-closed behavior is required**.

### 9.1 Apply standard tenant RLS
This sets RLS on a table and creates baseline policies.

```sql
create schema if not exists app;

create or replace function app.apply_tenant_rls(_table regclass)
returns void
language plpgsql
as $$
declare
  _tbl text := _table::text;
begin
  execute format('alter table %s enable row level security', _tbl);
  execute format('alter table %s force row level security', _tbl);

  execute format('drop policy if exists tenant_select on %s', _tbl);
  execute format('drop policy if exists tenant_insert on %s', _tbl);
  execute format('drop policy if exists tenant_update on %s', _tbl);
  execute format('drop policy if exists tenant_delete on %s', _tbl);

  execute format($f$
    create policy tenant_select on %1$s
    for select
    using (
      tenant_id = current_setting('app.tenant_id')::uuid
    )
  $f$, _tbl);

  execute format($f$
    create policy tenant_insert on %1$s
    for insert
    with check (
      tenant_id = current_setting('app.tenant_id')::uuid
    )
  $f$, _tbl);

  execute format($f$
    create policy tenant_update on %1$s
    for update
    using (
      tenant_id = current_setting('app.tenant_id')::uuid
    )
    with check (
      tenant_id = current_setting('app.tenant_id')::uuid
    )
  $f$, _tbl);

  execute format($f$
    create policy tenant_delete on %1$s
    for delete
    using (
      tenant_id = current_setting('app.tenant_id')::uuid
    )
  $f$, _tbl);
end;
$$;
```

### 9.2 Assert tenant-scoped invariants (migration-time hard fail)

```sql
create or replace function app.assert_tenant_scoped_table(_table regclass)
returns void
language plpgsql
as $$
declare
  _tbl_oid oid := _table::oid;
  _tbl text := _table::text;
  _has_tenant_id boolean;
  _tenant_not_null boolean;
  _rls_enabled boolean;
  _rls_forced boolean;
  _pol_r boolean;
  _pol_a boolean;
  _pol_w boolean;
  _pol_d boolean;
begin
  select exists (
    select 1
    from pg_attribute a
    where a.attrelid = _tbl_oid
      and a.attname = 'tenant_id'
      and a.attisdropped = false
  ) into _has_tenant_id;

  if not _has_tenant_id then
    raise exception 'SECURITY: table % is missing required column tenant_id', _tbl;
  end if;

  select exists (
    select 1
    from pg_attribute a
    where a.attrelid = _tbl_oid
      and a.attname = 'tenant_id'
      and a.attnotnull = true
  ) into _tenant_not_null;

  if not _tenant_not_null then
    raise exception 'SECURITY: table % tenant_id must be NOT NULL', _tbl;
  end if;

  select c.relrowsecurity, c.relforcerowsecurity
  into _rls_enabled, _rls_forced
  from pg_class c
  where c.oid = _tbl_oid;

  if _rls_enabled is distinct from true then
    raise exception 'SECURITY: table % must have RLS enabled', _tbl;
  end if;

  if _rls_forced is distinct from true then
    raise exception 'SECURITY: table % must have RLS forced', _tbl;
  end if;

  select exists (select 1 from pg_policy p where p.polrelid = _tbl_oid and p.polcmd = 'r') into _pol_r;
  select exists (select 1 from pg_policy p where p.polrelid = _tbl_oid and p.polcmd = 'a') into _pol_a;
  select exists (select 1 from pg_policy p where p.polrelid = _tbl_oid and p.polcmd = 'w') into _pol_w;
  select exists (select 1 from pg_policy p where p.polrelid = _tbl_oid and p.polcmd = 'd') into _pol_d;

  if not (_pol_r and _pol_a and _pol_w and _pol_d) then
    raise exception 'SECURITY: table % must define RLS policies for SELECT/INSERT/UPDATE/DELETE', _tbl;
  end if;
end;
$$;
```

---

## 10) AdonisJS migration example (plugin table)

A plugin migration should:
1) create table with `tenant_id`
2) apply RLS policies
3) assert invariants (hard fail if wrong)

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class PluginReviewsItems extends BaseSchema {
  protected tableName = 'plugin_reviews_items'

  async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('tenant_id')
        .notNullable()
        .defaultTo(this.schema.raw("current_setting('app.tenant_id')::uuid"))
        .references('id')
        .inTable('tenants')
        .onDelete('RESTRICT')

      table.text('title').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['tenant_id', 'created_at'])
    })

    await this.db.rawQuery(`select app.apply_tenant_rls(?::regclass)`, [this.tableName])
    await this.db.rawQuery(`select app.assert_tenant_scoped_table(?::regclass)`, [this.tableName])
  }

  async down () {
    this.schema.dropTable(this.tableName)
  }
}
```

**MUST:** if a plugin adds tables and does not call `assert_tenant_scoped_table()` in migrations, the plugin is rejected.

---

## 11) CI schema audit (backstop)

CI should fail if this query returns any rows.

```sql
with tenant_scoped_tables as (
  select c.oid, n.nspname, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema')
    and c.relname not in ('tenants')
)
select t.nspname, t.relname,
  exists (
    select 1 from pg_attribute a
    where a.attrelid = t.oid and a.attname = 'tenant_id' and a.attisdropped = false
  ) as has_tenant_id,
  (select c.relrowsecurity from pg_class c where c.oid = t.oid) as rls_enabled,
  (select c.relforcerowsecurity from pg_class c where c.oid = t.oid) as rls_forced
from tenant_scoped_tables t
where not exists (
    select 1 from pg_attribute a
    where a.attrelid = t.oid and a.attname = 'tenant_id' and a.attisdropped = false
  )
  or (select c.relrowsecurity from pg_class c where c.oid = t.oid) is distinct from true
  or (select c.relforcerowsecurity from pg_class c where c.oid = t.oid) is distinct from true;
```

---

## 12) Plugin review checklist (fast)

### 12.1 General
- [ ] Plugin has `plugin.meta.json` with `id`, `tier`, `requestedCapabilities`.
- [ ] Plugin is installed via `@pkg/config` loader map.
- [ ] No runtime fs scanning.
- [ ] Server entrypoints resolve to JS in `dist/`.
- [ ] Metadata is exports-safe (`./plugin.meta.json`).
- [ ] Type augmentation is included via `@pkg/config/plugins.types`.
- [ ] No open context; uses facades/registrars.
- [ ] Routes (if any) are namespaced under `/apps/<pluginId>`.
- [ ] Client does not do global request interception.

### 12.2 If the plugin adds DB tables
- [ ] Table names are prefixed `plugin_<pluginId>_*`.
- [ ] All plugin tables have `tenant_id uuid not null`.
- [ ] FK to `tenants(id)`.
- [ ] Index begins with `tenant_id`.
- [ ] RLS enabled + forced.
- [ ] Policies exist for select/insert/update/delete.
- [ ] Migration calls `app.assert_tenant_scoped_table()` (hard fail).
- [ ] No global tables without explicit allowlist + approval.

---

End of document.
