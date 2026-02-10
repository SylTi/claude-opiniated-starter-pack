# Plugin Collab Spec (Tier C)
**Status:** Draft for implementation
**Depends on:** `tier-c-platform-plugins-spec.md`, `plugin-dependency-enforcement-spec.md`, `plugins-mandatory-rules.md`

---

## 0) Purpose

Define a reusable `collab` Tier C plugin that exposes collaboration primitives for other app plugins.

Design goals:
- Enable comments, mentions, shares, and threads across plugin-owned resources.
- Keep enforcement server-side (non-bypassable by direct API calls).
- Support tenant/user-facing and admin-facing operation modes.
- Allow optional dependency on a `files` plugin for future attachments.

Non-goals (v1):
- File attachments/reactions.
- Real-time presence/cursors.

---

## 1) Capability and dependency model

### 1.1 Tier and capabilities

`collab` is a Tier C plugin and requests only required core capabilities.

Example requested capabilities:
- `app:authz`
- `core:service:users:read`
- `core:service:resources:read`
- `core:service:permissions:manage`
- `core:service:notifications:send` (optional behavior if unavailable)
- `core:hooks:define`
- `core:entity:fk:users`

### 1.2 Plugin dependencies

`collab` may declare plugin dependencies in manifest:

```json
{
  "pluginId": "collab",
  "tier": "C",
  "dependencies": ["files"]
}
```

Rules:
- Base collab v1 runs without `files`.
- Attachment endpoints are unavailable unless `files` is installed+enabled.
- Dependency lifecycle follows `plugin-dependency-enforcement-spec.md`.

---

## 2) Feature gates (core-owned)

Collab features are core-enforced through plugin feature policy:

```json
{
  "features": {
    "comments": { "defaultEnabled": true },
    "shares": { "defaultEnabled": true },
    "mentions": { "defaultEnabled": true },
    "threads": { "defaultEnabled": true }
  }
}
```

Rules:
- Route-level `requiredFeatures` MUST be set for feature-specific endpoints.
- Direct API calls to disabled features MUST return:
  - HTTP `403`
  - `{ "error": "E_FEATURE_DISABLED", "message": "Feature <id> is disabled for this tenant" }`
- Main app hard-disable policy takes precedence over tenant config.

---

## 3) Data model (v1)

Tables (plugin-owned):
- `plugin_collab_comments`
- `plugin_collab_shares`
- `plugin_collab_mentions`

Key rules:
- `tenant_id` required on all rows.
- `author_user_id` / `mentioned_user_id` FKs to `users.id` with `ON DELETE SET NULL`.
- Use integer IDs (per implementation deviations).

`plugin_collab_comments` minimum fields:
- `id`, `tenant_id`
- `resource_type`, `resource_id`
- `body`, `author_user_id`
- `parent_id` nullable (threads)
- `created_at`, `updated_at`, `deleted_at`

---

## 4) API surface

Base prefix: `/api/v1/apps/collab`

Endpoints:
- `POST /comments` (required feature: `comments`)
- `GET /comments` (required feature: `comments`)
- `DELETE /comments/:id` (required feature: `comments`)
- `POST /shares` (required feature: `shares`)
- `GET /shares` (required feature: `shares`)
- `DELETE /shares/:id` (required feature: `shares`)
- `GET /mentions` (required feature: `mentions`)
- `POST /mentions/:id/read` (required feature: `mentions`)

Thread behavior:
- Creating a comment with `parent_id` requires `threads` feature.

Response shape:
- Success: `{ data, message? }`
- Failure: `{ error, message, errors? }`

---

## 5) Resource and authz behavior

### 5.1 Resource ownership checks

Before writes, `collab` resolves target resource via `ResourcesFacade.resolve(resourceType, resourceId)`.

If unresolved:
- Return `404` with `ResourceNotFound`.

### 5.2 Permission checks

Collab defines abilities under `collab.` namespace.

Examples:
- `collab.comment.create`
- `collab.comment.delete`
- `collab.share.manage`

Rules:
- `grant/revoke` scoped to `collab.` namespace.
- `check/require` can validate cross-namespace abilities when needed.
- `collab` exports an `authzResolver` for `collab.*` abilities and requests `app:authz`.
- Default role policy:
  - `owner`: comment create/delete + share manage = allowed
  - `admin`: comment create/delete + share manage = allowed
  - `member`: comment create = allowed, comment delete/share manage = denied
- Tenant config may override role booleans under:
  - `config.rbac.roles.{owner|admin|member}.{comment_create|comment_delete|share_manage}`

### 5.3 Tenant member primitives

Collab may expose tenant-member discovery primitives for host plugins (for mentions/sharing UX), backed by:
- `UsersFacade.search()`
- host-plugin/team-specific RBAC hooks and filters

Important:
- Membership visibility and sensitive attributes are still controlled by core + host plugin RBAC.
- Collab returns only minimum user fields needed for UX.

---

## 6) Hooks and integration primitives

Collab emits namespaced hooks for extensibility:
- `collab:comment.created`
- `collab:comment.deleted`
- `collab:share.created`
- `collab:mention.created`

Filters:
- `collab:comment.render`
- `collab:mention.autocomplete`
- `collab:resource.types`

Rules:
- Other plugins can listen without direct runtime dependency.
- Typed augmentation is optional when provider package is a direct dependency.
- Listener registration uses `HookListenerRegistry`; dispatching uses collab internal paths only.

---

## 7) Admin vs tenant mode

Collab supports both:
- Tenant/user mode: end-user collaboration endpoints.
- Admin mode: policy/configuration endpoints managed by host/admin plugin.

Requirements:
- Admin routes must enforce admin-only abilities.
- Admin-configured hard disables are enforced by core feature policy on user routes.

---

## 8) Implementation checklist

1. Add collab manifest with Tier C fields, capabilities, hooks/filters, and features.
2. Add migrations + seed updates for collab tables.
3. Implement server routes with `requiredFeatures` and authz checks.
4. Implement hook dispatch and filter integration.
5. Implement mention notifications with graceful degradation when notifications facade is null.
6. Add tests:
   - unit: feature gate enforcement and permission checks
   - integration: comment/share/mention/thread flows
   - integration: direct API `403 E_FEATURE_DISABLED` when feature disabled
7. Add docs for host-plugin integration and hook contracts.

---

## 9) Open follow-ups

1. Attachment profile for `files` dependency (endpoint contracts + lifecycle).
2. Whether to add collab-specific list/query resource provider operations (beyond `resolve`).
3. Optional event versioning for hook payload evolution.
