# 11 — RBAC Extensions (Rule packs) (plugAndPlay)
**Classification:** plugAndPlay  
**Depends on**: **02-rbac-core**  
**Mandatory for** : —

---

## Goal
Allow optional RBAC rule packs (enterprise logic) without mutating RBAC core.

---

## Rule composition
- Deterministic ordering
- Deny-overrides recommended:
  - if any rule returns deny → deny
  - else if any allow → allow
  - else abstain → fallback to RBAC core

---

## Toggle behavior
- Off: only RBAC core applies
- On: validate rule packs; failures quarantine the pack, not the app

---

End of document.
