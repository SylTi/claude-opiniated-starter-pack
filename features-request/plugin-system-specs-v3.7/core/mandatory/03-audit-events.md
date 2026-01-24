# 03 — Audit Events (Mandatory emitter)
**Classification:** mandatory  
**Depends on**: **01-tenancy**  
**Mandatory for** : **08-audit-log**, **09-audit-sinks**, **12-dlp**

---

## Goal
Provide a curated, stable audit event schema emitted by core.

This is NOT the persistence layer. Persistence/export are separate plugAndPlay features.

---

## Non-goals
- Do not emit raw SQL, raw request bodies, or arbitrary PII by default.
- Do not block product flows on sink failures.

---

## Event shape (minimum)
- `tenantId`
- `type` (e.g., `resource.read`, `resource.write`, `auth.login`, `billing.invoice_paid`)
- `at` (ISO timestamp)
- `actor` (userId/serviceId)
- `resource` (type + id)
- `meta` (small structured payload)

---

## Implementation order
1) Define event schema and type registry
2) Instrument core actions (auth, team/tenant, billing, admin changes, sensitive reads)
3) Emit to in-process bus
4) Allow plugAndPlay layers to subscribe/persist/export

---

End of document.
