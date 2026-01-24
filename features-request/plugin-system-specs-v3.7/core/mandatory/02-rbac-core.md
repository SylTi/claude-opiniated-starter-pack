# 02 — RBAC Core (Mandatory)
**Classification:** mandatory  
**Depends on**: **01-tenancy**  
**Mandatory for** : **04-sso**, **11-rbac-extensions**, **12-dlp**, and any privileged plugin capability.

---

## Goal
Provide a **baseline** authorization model that is always present and deterministic.

---

## Scope
RBAC core owns:
- roles per tenant membership (`owner/admin/member`)
- baseline permissions map (core actions)
- enforcement middleware / guards
- policy evaluation entrypoint

RBAC core explicitly does **not** allow arbitrary plugin mutation. Extensions happen via `11-rbac-extensions`.

---

## Deterministic decisions
- Deny by default.
- Explicit allow lists per role.
- Optional: resource ownership checks.

---

## Implementation notes
- RLS is the hard tenant boundary; RBAC decides access within that boundary.
- Keep RBAC evaluation pure and testable.
- Log denials for sensitive actions via `03-audit-events`.

---

End of document.
