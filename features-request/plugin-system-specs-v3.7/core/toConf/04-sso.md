# 04 — SSO (OIDC/SAML) (toConf)
**Classification:** toConf  
**Depends on**: **01-tenancy**, **02-rbac-core**  
**Mandatory for** : —

---

## Why toConf
SSO can break login flows and lock out users if misconfigured. It must be configured deliberately and tested.

---

## Requirements
- Per-tenant configuration
- At least one break-glass admin auth path (password + 2FA or console admin)
- Provider validation on enablement
- Claims mapping to roles/groups (RBAC integration)

---

## Provider model
SSO is implemented via the `SSOProvider` contract (see `plugins-system-final.md`).

---

## Toggle rule
- Enabling/disabling SSO is a deliberate admin/config action.
- Never silently change the default auth path for all users without warning.

---

End of document.
