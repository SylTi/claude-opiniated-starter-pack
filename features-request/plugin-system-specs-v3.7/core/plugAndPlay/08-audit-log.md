# 08 — Audit Log (persistence + UI) (plugAndPlay)
**Classification:** plugAndPlay  
**Depends on**: **03-audit-events**  
**Mandatory for** : —

---

## Goal
Persist curated audit events and expose an admin UI to browse/search them.

---

## Requirements
- Partition by tenant
- Retention policy per tenant
- Query performance (indexes on `tenant_id`, `at`, `type`, `actor`)

---

## Toggle behavior
- Turning off stops persistence + UI.
- Must not break core flows (events still emitted; just not stored here).

---

End of document.
