# RLS Blueprint (Tenant mandatory, app-managed auth + session variables)
This document is the concrete, security-first blueprint for Postgres RLS in a Next.js + AdonisJS architecture.

**Approach:** The API authenticates users itself and sets Postgres session variables per request:
- `app.user_id`
- `app.tenant_id`
- optional `app.assurance` (MFA level), `app.role` (coarse)

RLS policies use `current_setting('app.tenant_id')`.

---

## 1) Database roles and safety flags

### 1.1 Roles
- **migration_admin**: owns schema changes and can bypass RLS (used only in migrations/maintenance)
- **app_user**: used by the running API (RLS enforced)

### 1.2 FORCE RLS
For every tenant-scoped table:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
```

`FORCE` matters: it prevents accidental owner-bypass footguns.

---

## 2) Canonical tables (minimum)

### 2.1 tenants
```sql
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('personal','team')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 tenant_memberships
```sql
CREATE TABLE tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  status text NOT NULL CHECK (status IN ('active','invited','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX tenant_memberships_user_idx ON tenant_memberships(user_id);
```

### 2.3 tenant_invitations (optional MVP)
```sql
CREATE TABLE tenant_invitations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_invitations_tenant_idx ON tenant_invitations(tenant_id);
```

### 2.4 Example domain table (notes)
```sql
CREATE TABLE notes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_tenant_idx ON notes(tenant_id);
```

---

## 3) Session variables (how RLS knows the context)

In the request transaction:
```sql
SELECT set_config('app.user_id',   '<uuid>', true);
SELECT set_config('app.tenant_id', '<uuid>', true);
```

Use `true` = `SET LOCAL` scoped to the current transaction.

### Hard rule: transaction per request
With pooling, queries can hop connections.  
If you don’t run inside one transaction and pass the same client everywhere, your RLS context will be inconsistent.

---

## 4) Helper functions (recommended)

### 4.1 Read current tenant/user
```sql
CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.tenant_id', true)::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true)::uuid
$$;
```

### 4.2 Membership check (SECURITY DEFINER)
You often need membership checks in policies without creating recursive RLS headaches.
Use a carefully-audited definer function:

```sql
CREATE OR REPLACE FUNCTION app_is_tenant_member(t uuid, u uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.tenant_id = t
      AND m.user_id = u
      AND m.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION app_is_tenant_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_tenant_member(uuid, uuid) TO app_user;
```

**Important:** Keep definer functions minimal. Don’t add side effects.

---

## 5) RLS policies (templates)

### 5.1 tenants table
Tenants are visible only if you are a member.

```sql
CREATE POLICY tenants_select
ON tenants
FOR SELECT
TO app_user
USING (
  app_is_tenant_member(id, app_current_user_id())
);
```

### 5.2 tenant_memberships table
Users can see memberships in their current tenant.

```sql
CREATE POLICY memberships_select
ON tenant_memberships
FOR SELECT
TO app_user
USING (
  tenant_id = app_current_tenant_id()
  AND app_is_tenant_member(tenant_id, app_current_user_id())
);
```

### 5.3 notes table (tenant isolation + membership)
```sql
CREATE POLICY notes_rw
ON notes
FOR ALL
TO app_user
USING (
  tenant_id = app_current_tenant_id()
  AND app_is_tenant_member(tenant_id, app_current_user_id())
)
WITH CHECK (
  tenant_id = app_current_tenant_id()
  AND app_is_tenant_member(tenant_id, app_current_user_id())
);
```

You can extend with RBAC checks by joining a permission table or by exposing a `app_can(action, resource)` function.

---

## 6) AdonisJS integration pattern (critical)

### 6.1 Request middleware
- authenticate user
- resolve `tenant_id` (subdomain/path/header/cookie)
- verify membership (in app logic; RLS will also enforce but you want a clean 403 early)
- open transaction
- `SET LOCAL app.user_id` and `app.tenant_id`
- attach transaction client to ctx (e.g., `ctx.db`)

Pseudo-code:

```ts
// Adonis middleware (conceptual)
await Database.transaction(async (trx) => {
  await trx.rawQuery("select set_config('app.user_id', ?, true)", [user.id])
  await trx.rawQuery("select set_config('app.tenant_id', ?, true)", [tenantId])

  ctx.db = trx // all repositories must use ctx.db
  await next()
})
```

### 6.2 Guardrail (do not allow global DB client in request handlers)
Adopt a hard convention:
- repositories accept `db` explicitly
- controllers/services do not import `Database` directly

This is how you avoid accidental RLS bypass via “wrong client”.

---

## 7) Background jobs
Jobs must also run with context:
- tenantId is part of job payload
- job runner opens transaction
- sets `app.tenant_id` (and possibly a service user id)
- executes queries

Never run jobs with a superuser connection unless explicitly in an admin lane.

---

## 8) Testing RLS (minimum)
- Create two tenants A/B
- Create a user who is member of A only
- Ensure queries for B return 0 rows / denied
- Ensure inserts cannot write tenant_id outside current tenant

Add regression tests for every new tenant-scoped table.

---

End of document.
