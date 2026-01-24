# 01 — Tenancy (Mandatory)
**Classification:** mandatory  
**Depends on**: —  
**Mandatory for** : **02-rbac-core**, **03-audit-events**, **04-sso**, **05-at-rest-encryption**, **07-vaults**, and all tenant-scoped domain tables.

---

## Goal
Make tenant context **always present** and enforce tenant boundaries at the database layer via **RLS**.

---

## Non-negotiable rules
1) Every authenticated request has a `currentTenantId`.
2) Every tenant-scoped table includes `tenant_id NOT NULL`.
3) All queries run under RLS with `SET LOCAL app.tenant_id`.
4) There is no “single-tenant without tenant context” runtime mode.

---

## Tenant selection
Pick one (decide once, apply everywhere):
- Subdomain (recommended for SaaS): `tenantSlug.app.com`
- Path prefix: `/t/{tenantSlug}/...`
- Cookie/header set by tenant switcher (works with either)

Regardless of transport, the API must resolve a **tenant id** and set it in DB session variables.

---

## Implementation order
1) Create tables: `tenants`, `tenant_memberships`
2) Implement tenant resolution + membership check
3) Implement request transaction + `set_config` (see `rls.md`)
4) Add RLS policies for core tables
5) Make every domain table tenant-scoped and covered by RLS

---

## Failure mode rules
- If tenant cannot be resolved → `400/401` (do not guess).
- If user not member → `403`.
- Never allow cross-tenant “admin shortcuts” in normal request paths.

---

End of document.
