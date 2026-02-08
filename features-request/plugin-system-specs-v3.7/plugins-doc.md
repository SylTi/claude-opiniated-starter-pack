# Plugin Author Guide — Notarium Plugin System (Tier A & Tier B)
This document is the **complete, authoritative guide** for building plugins that integrate cleanly and safely with the Notarium plugin system.

It covers:
- What Tier A and Tier B plugins are allowed to do
- The **full hook contract** (what you can register and how)
- Packaging, build, and monorepo rules (pnpm strict, exports, bundler-safe)
- Tenancy + RLS rules (tenant is mandatory)
- Routing rules (Next.js catch-all app hosting + Adonis namespaced routes)
- Migration rules and “tenant_id enforcement”
- Security, reliability, and performance requirements
- What you must never do (common footguns)

> Scope note: Tier C “Enterprise Providers” are core-owned and not covered here beyond constraints that Tier A/B must respect.

---

## 0) Mental model

### 0.1 Two runtimes, two registries
Plugins are not “isomorphic.” You write separate entry points:
- **Server plugin** (Adonis / Node): domain events, API augmentation, jobs, persistence
- **Client plugin** (Browser / React): UI augmentation (nav, settings, slots, theme, i18n)

There is **no** plugin runtime inside Next.js server components.  
If you need server-rendered data changes (SEO, initial nav), those must be produced by API responses and fetched by Next.

### 0.2 Installed vs enabled
A plugin can be:
- **installed**: shipped in the build artifact (static loader map)
- **enabled**: activated by runtime config (feature flags / admin config)

Your plugin must behave correctly in both cases:
- safe no-ops when disabled
- clean unregister/cleanup when hot reloaded in dev

### 0.3 Tenant is mandatory
Every authenticated request happens in a tenant context:
- every tenant-owned table must have `tenant_id NOT NULL`
- RLS enforces tenant isolation in the database
- you must never attempt cross-tenant reads/writes in app code

---

## 1) Plugin tiers (what you are allowed to build)

### Tier A — UI Plugin (unprivileged)
Tier A is **UI-only**:
- modify navigation and menus
- add settings tabs
- inject widgets into predefined UI slots
- provide theme and translation contributions

Tier A cannot:
- register API routes
- create DB tables
- add jobs/workers
- access secrets
- bypass tenancy or RBAC rules

### Tier B — App Plugin (moderately privileged)
Tier B can build “full-blown app experiences” inside Notarium:
- provide pages under `/apps/{pluginId}/...` (Next.js host route)
- register API routes under `/api/v1/apps/{pluginId}/...` (Adonis)
- define its own DB tables (tenant-scoped + RLS enforced)
- register jobs/workers (tenant-scoped execution)

Tier B still cannot:
- bypass tenant isolation
- bypass RBAC
- hook into raw DB query interception
- attach global request interceptors in the browser
- change core authentication/session issuance

---

## 2) The full hook contract (what you can register)

### 2.1 Hook mechanics
There are two kinds of hooks:

**Actions (events):**
- fire and forget (side effects)
- do not modify payload
- can run async

**Filters (transformations):**
- must return a value (can modify)
- run in sequence
- must be deterministic and safe

Ordering:
- `priority` lower runs first
- stable ordering for equal priority (registration order)

Failure behavior:
- a plugin failure must not crash the app
- errors are isolated (plugin marked as failed/quarantined if configured)

### 2.2 Server Actions (Events)
> Available in server runtime (Adonis).

**Auth**
- `auth:registered` (Payload: `{ userId, email, tenantId }`)
- `auth:logged_in` (Payload: `{ userId, method, tenantId }`) — `method`: `'password'` | `'mfa'` | `'google'` | `'github'` | `'sso'`
- `auth:logged_out` (Payload: `{ userId }`)
- `auth:mfa_verified` (Payload: `{ userId }`)
- `auth:password_reset` (Payload: `{ userId }`)

**Teams / Tenancy (tenant == team conceptually)**
- `team:created` (Payload: `{ tenantId, ownerId, type }`) — `type`: `'personal'` | `'team'`
- `team:updated` (Payload: `{ tenantId, updatedFields }`)
- `team:deleted` (Payload: `{ tenantId, tenantName }`) — fired before deletion
- `team:member_added` (Payload: `{ tenantId, userId, role }`)
- `team:member_removed` (Payload: `{ tenantId, userId, role }`)
- `team:member_left` (Payload: `{ tenantId, userId, role }`) — voluntary leave
- `team:switched` (Payload: `{ userId, tenantId, previousTenantId }`)

**Billing** (enriched payloads for MRR/ARR/LTV calculation)
- `billing:customer_created` (Payload: `{ tenantId, customerId }`)
- `billing:subscription_created` (Payload: `{ tenantId, subscriptionId, tierId, providerSubscriptionId, amount, currency, interval }`)
- `billing:subscription_updated` (Payload: `{ tenantId, subscriptionId, status, previousStatus, tierId, amount, currency, interval }`)
- `billing:subscription_cancelled` (Payload: `{ tenantId, subscriptionId, tierId }`)
- `billing:invoice_paid` (Payload: `{ tenantId, subscriptionId, amountPaid, currency, invoiceId }`)
- `billing:payment_failed` (Payload: `{ tenantId, subscriptionId, invoiceId }`)

**Compliance & System**
- `audit:record` (Payload: `{ type, tenantId, actor, resource, meta }`) — mirrors every audit event
- `http:request` (Payload: `ctx`) — observe only (Tier A/B must not mutate global behavior)
- `http:response` (Payload: `ctx, body`) — observe only (Tier A/B must not perform DLP here; core-owned)
- `db:query` (Payload: `query, bindings`) — observe only (perf monitoring; do not rely on this for logic)
- `app:capabilities:register` (Payload: `registry`) — register plugin capabilities (declared + approved)
- `app:shutdown` (Payload: `{}`)

### 2.3 Client Filters (Data Transformation)
> Available in client runtime (Browser).

**Navigation**
- `ui:nav:main` (Payload: `items[], user, team`)
- `ui:nav:admin` (Payload: `items[]`)
- `ui:user:menu` (Payload: `items[], user`)

**Settings**
- `ui:settings:tabs:user` (Payload: `tabs[]`)
- `ui:settings:tabs:team` (Payload: `tabs[]`)

**Theme & I18n**
- `ui:theme:config` (Payload: `theme`)
- `ui:i18n:translations` (Payload: `lang, keys`)

### 2.4 Client Slots (Widget Injection Points)
> Exposed as slot filters returning `SlotWidget[]` for a given slot id.

**Dashboard**
- `dashboard.main.top`
- `dashboard.main.bottom`
- `dashboard.sidebar`

**Admin**
- `admin.dashboard.widgets`
- `admin.user.detail.after`

**Profiles**
- `user.profile.header.actions`
- `team.profile.header`

**Auth**
- `auth.login.form.after`
- `auth.register.form.after`

---

## 3) Capabilities & approvals (you must declare what you need)

### 3.1 You do not get access “because you can”
All plugin behavior is capability gated:
- you must request capabilities in your plugin metadata
- admins approve them (or deny)
- core enforces them at runtime

If you try to use an unapproved surface:
- your plugin will fail boot (isolated)
- the app continues without you

### 3.2 Typical Tier A capabilities
- `ui.nav.write`
- `ui.settings.write`
- `ui.slots.write`
- `ui.theme.write`
- `ui.i18n.write`

### 3.3 Typical Tier B capabilities
Everything in Tier A, plus:
- `app.pages.expose`
- `app.api.routes.register`
- `app.jobs.register`
- `storage.read` / `storage.write` (only via facade, within plugin namespace)

---

## 4) Repository & packaging rules (pnpm strict + bundler-safe)

### 4.1 No dynamic plugin discovery
Plugins are declared via **static loader maps** in `@pkg/config`.
Do not depend on runtime `fs.readdir` scanning.

### 4.2 pnpm strict dependency rule (no phantom deps)
If your plugin imports a library, it must be in **your plugin package.json** dependencies.

Do not rely on:
- root deps
- deps of `@pkg/config`
- deps of other plugins

### 4.3 Exports-safe metadata
Your plugin must export:
- `./plugin.meta.json`
- `./client` (TS ok; Next transpiles)
- `./server` (MUST be JS in dist)

Example required exports:
- `./plugin.meta.json`
- `./types` (type augmentation d.ts)
- `./client` (browser entry)
- `./server` (node entry, built)

### 4.4 Server code must be built to JS
Node in production cannot execute TS in node_modules.
Your server entry must be `dist/server.js`, and package.json exports must point to it.

---

## 5) Type safety (module augmentation) — mandatory
Hooks are strongly typed via TypeScript module augmentation.

### 5.1 You must export your augmentation
Provide a `src/types.d.ts` with `declare module ...` additions (if you add plugin-specific hooks), and export it via:
- `exports: { "./types": "./src/types.d.ts" }`

### 5.2 Core aggregates all plugin types
Core imports a generated/maintained aggregator:
- `@pkg/config/plugins.types`
Both apps import that file so TypeScript sees all augmentations.

Your plugin must ensure its exported types file is included in the aggregator.

---

## 6) Tenancy + RLS rules (absolutely non-negotiable)

### 6.1 Tenant-scoped tables are mandatory for plugin data
If you create tables:
- `tenant_id uuid NOT NULL`
- FK to tenants
- index beginning with `tenant_id`
- RLS enabled and forced
- policies exist for SELECT/INSERT/UPDATE/DELETE

### 6.2 Migration-time hard fail
All plugin migrations must call the core helper:
- `app.apply_tenant_rls('your_table')`
- `app.assert_tenant_scoped_table('your_table')`

If tenant_id is missing or RLS is not set:
- migration fails
- plugin cannot be deployed

### 6.3 Default tenant_id on insert
Use DB default:
- `tenant_id DEFAULT current_setting('app.tenant_id')::uuid`
This prevents “developer forgot to set tenant_id” bugs.

### 6.4 You must use request-scoped DB client
All server work must use the request transaction client where:
- `SET LOCAL app.tenant_id`
- `SET LOCAL app.user_id`
are configured

Do not use a global DB connection in handlers.

---

## 7) Tier A plugin guide (UI-only)

### 7.1 What you can do
- add nav items (main/admin)
- add user menu items
- add settings tabs (user/team)
- inject slot widgets (dashboard/admin/profile/auth)
- add theme config overrides
- provide i18n translations

### 7.2 What you must NOT do
- store secrets in localStorage
- call external APIs without explicit user action (privacy)
- create global side effects in module top-level scope
- block rendering with long async operations

### 7.3 Patterns (examples)

#### Add a nav item
- filter: `ui:nav:main`
- return a new array (do not mutate input)

#### Add a settings tab
- filter: `ui:settings:tabs:user`
- ensure stable ids

#### Slot widget injection
- filter: e.g. `dashboard.main.top`
- return `SlotWidget[]` describing component + props

---

## 8) Tier B plugin guide (App plugins)

### 8.1 What you can do
Everything Tier A can do, plus:

**Frontend**
- provide pages rendered under `/apps/{pluginId}/...` via Next host route
- provide internal navigation for your app area

**Backend**
- register API routes under `/api/v1/apps/{pluginId}/...`
- create tenant-scoped tables + models
- register tenant-scoped jobs

### 8.2 Routing rules (hard)
- You may only mount under your namespace:
  - Web: `/apps/{pluginId}/...`
  - API: `/api/v1/apps/{pluginId}/...`
- You may not register or override core routes.

### 8.3 Data rules
- All plugin data tables must be tenant-scoped + RLS.
- You must not store tenant-owned data in global tables.
- If you need global “definitions” (rare), request explicit approval and use security definer functions (core-owned pattern).

### 8.4 Job rules
Jobs must carry:
- `tenant_id`
- optional: `actor_user_id` (if needed for auditing)
Jobs must set tenant context before DB access.

---

## 9) Performance and reliability requirements

### 9.1 No slow hooks
- Hooks run inline with user actions.
- Keep hook logic fast.
- Offload heavy work to jobs.

### 9.2 Idempotency
Actions may be retried. Your handlers must be idempotent where possible.
Use unique keys, upserts, or dedup tables.

### 9.3 No nondeterministic filters
Filters must be deterministic:
- given the same input, return the same output
Avoid randomness/time-based behavior.

### 9.4 Error handling
- Throwing errors should not crash the app.
- Log with structured context:
  - plugin id, hook, tenant id (if available), request id
- Avoid swallowing errors silently.

---

## 10) Security rules (must-follow)

### 10.1 No secrets in client plugins
Never ship:
- API keys
- private tokens
- encryption keys
to the browser.

### 10.2 Data egress
Do not exfiltrate tenant data to external services without:
- explicit tenant admin configuration
- explicit user/tenant consent
- auditable records (core-owned)

### 10.3 Respect RBAC
Do not implement “own permission checks” with ad-hoc logic.
Use core authorization facilities.

### 10.4 No “open context”
You will receive controlled facades and scoped registrars, not raw/unscoped core `db/router/drive/bouncer`.
Tenant-scoped DB access for plugin-owned tables is allowed where the contract provides it.
Do not attempt to bypass them.

---

## 11) Migrations, versioning, and uninstall

### 11.1 Migrations must be safe
- Never drop columns/tables without a migration path.
- Always preserve tenant boundaries.
- Provide downgrade strategy if required.

### 11.2 Uninstall semantics
If plugin is disabled:
- plugin UI surfaces disappear
- plugin API routes no longer mount
- data remains unless the admin explicitly runs a cleanup workflow

Never auto-delete tenant data on disable.

---

## 12) Quality gates (what your plugin will be reviewed for)

### Mandatory checklist
- [ ] Correct tier classification (A vs B)
- [ ] Correct capabilities requested
- [ ] No dynamic fs scanning
- [ ] Exports-safe metadata present
- [ ] Server entry built to JS (dist)
- [ ] All tables have tenant_id + RLS forced
- [ ] Migration asserts tenancy invariants
- [ ] Uses request-scoped DB client
- [ ] Namespaced routing only
- [ ] No client secrets / no global interceptors
- [ ] Filters are pure + non-mutating
- [ ] Hooks are fast and resilient

---

## Appendix A — Hook registration rules (best practices)

### Actions
- must not change app control flow
- should not throw for expected conditions
- should be idempotent

### Filters
- must return same type as input
- must not mutate input arrays/objects in place
- should preserve stable ordering unless explicitly intended

### Priority
- Use priority to resolve conflicts with other plugins.
- Default priority should be neutral (e.g., 10).
- Lower number runs earlier.

---

## Appendix B — Common footguns (do not do this)

- Writing plugin server code in TS and exporting it directly (production crash)
- Importing package.json without exporting it (ERR_PACKAGE_PATH_NOT_EXPORTED)
- Creating tables without tenant_id (security hole; migration must fail)
- Attempting to implement tenancy by query WHERE clauses (must be RLS + enforced context)
- Using global fetch interceptors in the browser (data exfiltration risk)
- Doing response-body regex DLP in a filter (breaks payloads and is unsafe)
- Relying on db:query or http:* hooks for core security behavior (Tier C only; core-owned)

---

End of document.
