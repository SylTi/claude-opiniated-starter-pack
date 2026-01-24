# How plugin actions are written to the Audit Log

This plugin system treats audit logging as a **core-owned security boundary**. Plugins do not “own” audit storage. Plugins **request** audit records; core **validates, enriches, and persists** them in a tenant-scoped audit table under RLS.

There are **two supported ways** plugin activity becomes an audit entry:

1) **Automatic auditing** via core facades/services (preferred)
2) **Explicit auditing** via `audit.record()` (allowed for plugin-specific business events)

---

## 1) Core principles (non-negotiable)

### 1.1 Plugins never write to audit tables directly
A plugin must **not** insert into `audit_log` itself.

Reasons:
- prevents spoofing tenant/user
- enforces schema consistency
- enforces redaction rules
- prevents bypassing RLS context mistakes

### 1.2 Audit logging is tenant-scoped and RLS-enforced
Audit entries are stored in a tenant-scoped table (example):

- `audit_log`
  - `tenant_id` (NOT NULL)
  - `actor_user_id` (nullable for system events)
  - `source` (`core` or `plugin:<pluginId>`)
  - `action` (namespaced string)
  - `resource_type`, `resource_id`
  - `meta` (JSONB, size-limited, allowlisted/redacted)
  - timestamps

RLS policy ensures:
- writes are only allowed for `tenant_id = current_setting('app.tenant_id')::uuid`
- reads are only allowed in the active tenant

### 1.3 Audit must use request-scoped DB context
All server-side audit writes must happen using the same request transaction client where:
- `SET LOCAL app.tenant_id`
- `SET LOCAL app.user_id`
were set by middleware.

No request-scoped db ⇒ do not write audit (fail closed or treat as system event with explicit tenant context in a job).

---

## 2) What the plugin gets: the AuditFacade

### 2.1 Contract (server runtime only)
Plugins receive an `audit` facade in the server plugin context:

- `audit.record(event)` — create an audit entry
- `audit.childScope(meta)` — optional; derive a scoped logger with pre-attached meta
- `audit.safeMeta(meta)` — optional; enforce size + redaction (core-owned)

**Conceptual TypeScript interface:**
~~~ts
export type AuditResource = {
  type: string;
  id?: string | number;
};

export type AuditActor =
  | { userId: string }
  | { system: true; reason?: string };

export type AuditEvent = {
  action: string;                 // e.g. "plugin:reviews:item.created"
  resource?: AuditResource;       // what was affected
  actor?: AuditActor;             // defaults to ctx.auth.user when available
  meta?: Record<string, unknown>; // small, redacted/allowlisted
};

export interface AuditFacade {
  record(event: AuditEvent): Promise<void>;
}
~~~

### 2.2 Enrichment done by core (not plugin)
Core automatically attaches (when available):
- `tenant_id` from request context
- `actor_user_id` from auth context
- request correlation info (request id)
- user agent / ip if allowed by privacy policy
- `source = plugin:<pluginId>`

Plugins can’t spoof these fields.

---

## 3) Automatic auditing (preferred)

### 3.1 How it works
Core-provided facades/services emit audit events internally.

Examples:
- StorageFacade: `storage.put(...)` emits `storage.write`
- ExportService: `exports.create(...)` emits `export.created`
- PluginRoutesRegistrar: optional “plugin route mounted” audit (boot-time)
- PluginDataRepository: emits `data.create`, `data.update`, `data.delete`

### 3.2 Why it’s preferred
- plugin authors cannot forget to audit
- consistent action naming
- consistent redaction
- security reviews become simpler

### 3.3 When to rely on it
Use automatic auditing whenever you use:
- storage
- exports
- admin-level mutations
- data mutation repositories provided by core

If you are doing direct DB inserts/updates (allowed for Tier B), you should add explicit audit (see below) unless your repository wrapper auto-audits.

---

## 4) Explicit plugin audit events (allowed)

### 4.1 When you should use explicit audit
Use explicit audit when the event is:
- business-specific to your plugin
- not inferable from core facades
- important for compliance or incident response

Examples:
- “User enabled feature X inside plugin”
- “User exported plugin dataset”
- “Plugin configuration changed”
- “Plugin created/updated/deleted a tenant-owned record”

### 4.2 Naming convention (mandatory)
Plugin audit actions must be namespaced:

- `plugin:<pluginId>:<domain>.<verb>`
Examples:
- `plugin:reviews:item.created`
- `plugin:reviews:item.deleted`
- `plugin:motion:workflow.published`

Avoid generic actions like `create` or `update`.

### 4.3 Meta rules (mandatory)
Audit meta must be:
- small (enforce a size limit; e.g., 2–8 KB)
- redacted (no secrets, no raw tokens, no plaintext sensitive content)
- stable (do not dump whole request bodies)

Good meta:
- ids, counts, flags, non-sensitive fields, version numbers

Bad meta:
- full note contents
- raw PII beyond necessity
- auth headers, session tokens
- cryptographic material

---

## 5) Example: Tier B route handler with explicit audit

~~~ts
export default async function ReviewsPlugin(ctx: ServerPluginContext) {
  const { routes, audit } = ctx;

  routes.registerApi({
    method: "POST",
    path: "/apps/reviews/items",
    handler: async (httpCtx) => {
      const { db, tenant, auth } = httpCtx;
      const user = auth.user!;

      // Tenant-scoped insert (tenant_id is defaulted by DB or set explicitly)
      const [item] = await db
        .table("plugin_reviews_items")
        .insert({
          title: httpCtx.request.input("title"),
          rating: httpCtx.request.input("rating"),
          tenant_id: tenant.id, // optional if DB default exists
          created_by: user.id,
        })
        .returning("*");

      // Explicit audit
      await audit.record({
        action: "plugin:reviews:item.created",
        resource: { type: "plugin_reviews_items", id: String(item.id) },
        meta: { rating: item.rating },
      });

      return item;
    },
  });
}
~~~

**What core will add automatically:**
- tenant_id
- actor_user_id
- source = plugin:reviews
- request id

---

## 6) Background jobs & system events

### 6.1 Jobs must carry tenant context
If a plugin job runs outside a request:
- it must have `tenant_id` in payload
- it must set `app.tenant_id` in its transaction before DB operations

Only then can it write audit entries safely.

### 6.2 System actor
For non-user initiated operations:

~~~ts
await audit.record({
  actor: { system: true, reason: "nightly_cleanup" },
  action: "plugin:reviews:cleanup.completed",
  meta: { deleted: 42 },
});
~~~

Core still attaches tenant_id from the job context.

---

## 7) How to prevent “plugins forget to audit” (recommended rule)

### 7.1 Mandatory auditing rule for Tier B data writes
If your plugin:
- introduces tenant-owned tables AND
- performs create/update/delete

Then you must:
- either use a core repository/facade that auto-audits, OR
- call `audit.record()` on each mutation path

This should be part of plugin review / CI checks.

---

## 8) Where to put this in the repo

Put this content in:

- `examples-plugins/tierB/audit.md`

and add a short link/section in your main plugin author guide:

- `examples-plugins/tierA/plugins.md` (short note: “Tier A cannot write audit directly; it’s UI-only.”)
- `examples-plugins/tierB/plugins.md` (link to `audit.md`)

Why that placement:
- It’s primarily relevant to Tier B (server routes + DB writes).
- Keeping it near Tier B examples makes it “unmissable” when authors copy patterns.

If you prefer a single canonical docs location instead, use:
- `core/plugAndPlay/XX-audit-log.md` (add a “Plugins integration” section)
…but the Tier B examples location is better for developer ergonomics.
