# ROADMAP Downgrades (`x` -> `~`)

This document explains each downgrade made in `ROADMAP.md`, with code evidence and what must be implemented to restore `x`.

## 1) OAuth 2.0 / OpenID Connect (Google, GitHub, Microsoft, etc.)

- Downgraded to `~` because only Google and GitHub are supported in code.
- Evidence:
  - `apps/api/config/ally.ts:4`
  - `apps/api/config/ally.ts:14`
  - `apps/api/app/controllers/oauth_controller.ts:16`

### To reach `x`
- Add Microsoft provider config (client ID/secret/callback) in Ally config.
- Extend provider typing/validation in OAuth controller.
- Add Microsoft login/link/unlink flow tests.
- Update API/docs and env examples.

## 2) RBAC (Role-Based Access Control) avec roles personnalisables

- Downgraded to `~` because RBAC exists, but roles are static and not tenant-customizable.
- Evidence:
  - `apps/api/app/constants/roles.ts:16`
  - `apps/api/app/constants/permissions.ts:60`

### To reach `x`
- Add DB-backed custom roles and role-permission assignments per tenant.
- Add role management APIs + UI.
- Use dynamic role resolution in authorization checks.
- Add migration/seed updates and full test coverage.

## 3) Recuperation de compte avancee

- Downgraded to `~` because only standard email-based reset/verify flows exist.
- Evidence:
  - `apps/api/start/routes.ts:53`
  - `apps/api/start/routes.ts:56`
  - `apps/api/start/routes.ts:58`

### To reach `x`
- Add advanced recovery options (recovery codes, trusted-device recovery, admin-assisted secure recovery).
- Add anti-abuse controls and additional auditing.
- Add UI and tests for the extended recovery flows.

## 4) Reçus et historique de paiements

- Downgraded to `~` because billing endpoints do not expose first-class payment history/receipt listing.
- Evidence:
  - `apps/api/start/routes.ts:250`

### To reach `x`
- Add endpoints for payment history/receipts/invoices list and detail.
- Add shared DTOs and frontend pages/components.
- Reconcile provider data and add tests for pagination/filtering.

## 5) Gestion des essais gratuits (7/14/30 jours)

- Downgraded to `~` because trial statuses are recognized from providers, but no app-level configurable trial lifecycle (7/14/30) is implemented.
- Evidence:
  - `apps/api/app/services/providers/stripe_provider.ts:375`
  - `apps/api/app/services/providers/paddle_provider.ts:438`

### To reach `x`
- Add explicit trial configuration (7/14/30 day options).
- Add trial eligibility and start/extend/end rules.
- Add trial UX (status/countdown/conversion) and tests.

## 6) Proration des paiements

- Downgraded to `~` because no explicit proration logic/preview is implemented in app flows.
- Evidence:
  - `apps/api/app/controllers/payment_controller.ts:75`

### To reach `x`
- Add explicit upgrade/downgrade endpoints with proration behavior controls.
- Add proration preview endpoint (before confirmation).
- Show proration amount breakdown in UI.
- Add provider-specific proration test cases.

## 7) Roles au niveau organisation (Owner, Admin, Member, Viewer)

- Downgraded to `~` because `viewer` role is missing.
- Evidence:
  - `apps/api/app/constants/roles.ts:16`

### To reach `x`
- Add `viewer` role constant and permission matrix.
- Update validators and member/invitation role handling.
- Add migration/seed updates and UI support.
- Add tests for viewer access boundaries.

## 8) Limites et quotas par organisation

- Downgraded to `~` because only member-count limits are clearly enforced; broader quotas are not.
- Evidence:
  - `apps/api/app/models/tenant.ts:131`
  - `apps/api/app/controllers/tenants_controller.ts:400`

### To reach `x`
- Define quota domains (storage/API/projects/automations/etc.).
- Add per-tenant quota config + usage counters.
- Enforce quotas consistently in services/controllers.
- Add quota observability/admin pages and tests.

## 9) Authentification API (JWT, OAuth2)

- Downgraded to `~` because authentication is session-based, not JWT/OAuth2 API auth.
- Evidence:
  - `apps/api/config/auth.ts:5`
  - `apps/api/app/middleware/auth_middleware.ts:22`

### To reach `x`
- Add bearer JWT guard and/or OAuth2 authorization server/token flows.
- Add API scopes/claims and protected route policies.
- Add token issuance/rotation/revocation + tests.
- Update API docs for auth schemes.

## 10) Gestion des appareils et sessions

- Downgraded to `~` because login history exists, but there is no full device/session management (list/revoke sessions/devices).
- Evidence:
  - `apps/api/start/routes.ts:70`

### To reach `x`
- Add session/device inventory endpoints.
- Add revoke single/all sessions and device invalidation.
- Track user-agent/IP/device fingerprints with security UX.
- Add tests for revocation behavior.

## 11) Politiques de mot de passe avancees

- Downgraded to `~` because password policy is currently basic min/max length.
- Evidence:
  - `apps/api/app/validators/auth.ts:9`
  - `apps/api/app/validators/auth.ts:107`

### To reach `x`
- Add complexity rules, reused-password prevention, breach/password-list checks.
- Add configurable tenant-level password policies.
- Add policy enforcement and error messaging across all flows.
- Add tests for all policy branches.

## 12) Feature flags par utilisateur/organisation

- Downgraded to `~` because current toggles are tenant/global oriented, not true per-user targeting for product flags.
- Evidence:
  - `apps/api/start/routes_enterprise.ts:52`
  - `apps/api/start/routes_plugins.ts:45`

### To reach `x`
- Add per-user targeting rules (user ID, segment, attributes).
- Add deterministic evaluation engine and override layers.
- Add admin UX for audience targeting and rollout inspection.
- Add audit/analytics around per-user flag evaluation.

## Notes

- Phase-level downgrades in `ROADMAP.md` follow directly from the feature-level downgrades above.
- If desired, these can be reclassified under a looser definition of "complete".
